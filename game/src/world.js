// Renderer, scene, dusk sky and lights for Viceport. One shared renderer; the sun sits low
// over the harbor so the whole city lives in a warm sunset with neon on top.
import * as THREE from 'three';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2340);
  scene.fog = new THREE.Fog(0x3a2c4c, 120, 620);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
  camera.position.set(0, 30, 60);

  // Sky dome: a big gradient sphere (sunset violet -> amber horizon -> sea teal glow).
  const skyGeo = new THREE.SphereGeometry(1200, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x241b3f) }, mid: { value: new THREE.Color(0x8a4460) }, low: { value: new THREE.Color(0xe88a4a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.75, h)) : mix(low, mid, smoothstep(-0.06, 0.22, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const sun = new THREE.DirectionalLight(0xffb37a, 2.4);
  sun.position.set(-260, 190, 320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340; sun.shadow.camera.bottom = -340;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a7bb8, 0x1c2438, 0.85));
  const fill = new THREE.DirectionalLight(0x5a76c8, 0.5);
  fill.position.set(200, 120, -260);
  scene.add(fill);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, sun };
}
