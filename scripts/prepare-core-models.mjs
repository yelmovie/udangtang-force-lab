import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

// Static Meshy source models only. Originals are retained outside public/.
const assets = [
  { id: 'core', source: 'references/models/original/core-cube-source.glb', output: 'public/assets/models/core/core.glb' },
  { id: 'dock', source: 'references/models/original/core-dock-source.glb', output: 'public/assets/models/core/dock.glb' },
];
await MeshoptSimplifier.ready;
// 2026-10-20: 22k triangles with free UV seams tore the core's surface. Seams are now locked (LockBorder)
// and more triangles are kept; the texture stays at 2048 so the baked panels stay sharp.
const TARGET = { core: 50000, dock: 12000 }, TEXTURE = 2048, OUT_DIR = process.env.CORE_OUT_DIR ?? 'public/assets/models/core';
const report = [];
for (const asset of assets) {
  const source = await readFile(resolve(asset.source));
  if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) throw new Error('Unsupported GLB');
  const jsonLength = source.readUInt32LE(12);
  const original = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  const binary = source.subarray(28 + jsonLength);
  if (original.meshes.length !== 1 || original.meshes[0].primitives.length !== 1 || original.animations?.length) throw new Error('Expected one static primitive');
  const primitive = original.meshes[0].primitives[0];
  function readAccessor(id, Type, components) {
    const accessor = original.accessors[id], view = original.bufferViews[accessor.bufferView];
    if (view.byteStride || accessor.sparse) throw new Error('Unsupported interleaved/sparse accessor');
    return new Type(binary.buffer, binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count * components);
  }
  const positions = readAccessor(primitive.attributes.POSITION, Float32Array, 3);
  const normals = readAccessor(primitive.attributes.NORMAL, Float32Array, 3);
  const uv = readAccessor(primitive.attributes.TEXCOORD_0, Float32Array, 2);
  const indices = readAccessor(primitive.indices, Uint32Array, 1);
  // Keep atlas seams: collapsing them makes Meshy's baked texture visibly smear.
  // The core has many small UV islands, so its safe triangle count can exceed the target.
  const [reduced, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, uv, 2, [.5, .5], null, TARGET[asset.id] * 3, .004, ['LockBorder']);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(reduced);
  function compact(input, components) {
    const out = new Float32Array(vertexCount * components);
    for (let old = 0; old < remap.length; old++) if (remap[old] !== 0xffffffff) {
      for (let k = 0; k < components; k++) out[remap[old] * components + k] = input[old * components + k];
    }
    return out;
  }
  const pos = compact(positions, 3), normal = compact(normals, 3), texcoord = compact(uv, 2);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { const k = i % 3; min[k] = Math.min(min[k], pos[i]); max[k] = Math.max(max[k], pos[i]); }
  const image = original.images[original.textures[original.materials[primitive.material].pbrMetallicRoughness.baseColorTexture.index].source];
  const imageView = original.bufferViews[image.bufferView];
  const imageBytes = binary.subarray(imageView.byteOffset ?? 0, (imageView.byteOffset ?? 0) + imageView.byteLength);
  const sourceTexture = await sharp(imageBytes).metadata();
  const texture = await sharp(imageBytes).resize(TEXTURE, TEXTURE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const chunks = [], views = []; let offset = 0;
  function append(bytes, target) {
    const data = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
    const index = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) });
    chunks.push(data); offset += data.length;
    const padding = (4 - offset % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    return index;
  }
  const indexArray = vertexCount <= 65535 ? Uint16Array.from(reduced) : reduced;
  const positionView = append(pos, 34962), normalView = append(normal, 34962), uvView = append(texcoord, 34962), indicesView = append(indexArray, 34963), textureView = append(texture);
  const document = {
    asset: { version: '2.0', generator: 'udangtang tablet preparation / meshoptimizer 0.25' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: asset.id, mesh: 0 }],
    meshes: [{ name: asset.id, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    accessors: [
      { bufferView: positionView, componentType: 5126, count: vertexCount, type: 'VEC3', min, max },
      { bufferView: normalView, componentType: 5126, count: vertexCount, type: 'VEC3' },
      { bufferView: uvView, componentType: 5126, count: vertexCount, type: 'VEC2' },
      { bufferView: indicesView, componentType: indexArray instanceof Uint16Array ? 5123 : 5125, count: reduced.length, type: 'SCALAR' },
    ],
    materials: [{ name: `${asset.id}-matte`, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: .06, roughnessFactor: .72 }, alphaMode: 'OPAQUE', doubleSided: false }],
    images: [{ bufferView: textureView, mimeType: 'image/jpeg' }], textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }], bufferViews: views, buffers: [{ byteLength: offset }],
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat(chunks), output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + bin.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson.length, 12); output.writeUInt32LE(0x4e4f534a, 16); paddedJson.copy(output, 20);
  const binOffset = 20 + paddedJson.length; output.writeUInt32LE(bin.length, binOffset); output.writeUInt32LE(0x004e4942, binOffset + 4); bin.copy(output, binOffset + 8);
  if (output.length > 4500000 || reduced.length / 3 > 120000) throw new Error(`Tablet model budget exceeded: ${asset.id} (${output.length} bytes, ${reduced.length / 3} triangles)`);
  await mkdir(resolve(OUT_DIR), { recursive: true });
  await writeFile(resolve(OUT_DIR, `${asset.id}.glb`), output);
  const result = { ...asset, sourceBytes: source.length, sourceTriangles: indices.length / 3, sourceSha256: createHash('sha256').update(source).digest('hex'), bytes: output.length, triangles: reduced.length / 3, vertices: vertexCount, simplificationError: error, texture: { sourceWidth: sourceTexture.width, sourceHeight: sourceTexture.height, width: Math.min(TEXTURE, sourceTexture.width), height: Math.min(TEXTURE, sourceTexture.height), bytes: texture.length, maps: 1 }, bounds: { min, max }, sha256: createHash('sha256').update(output).digest('hex') };
  report.push(result); console.log(JSON.stringify(result));
}
if (report.reduce((sum, item) => sum + item.bytes, 0) > 6000000) throw new Error('Combined tablet model budget exceeded');
await writeFile(resolve('scripts/core-models.json'), JSON.stringify({ prepared: '2026-10-20', assets: report }, null, 2) + '\n');
