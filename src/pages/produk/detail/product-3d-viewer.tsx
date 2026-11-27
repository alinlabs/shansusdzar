import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, RotateCcw, X } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { BrandRingLoader } from '../../../components/ui/brand-ring-loader';
import { DEFAULT_UNIVERSAL_COLOR } from '../../../lib/color-palette';
import { getDeviceCapabilities, getThreeDQualityProfile } from '../../../lib/device-capabilities';
import { loadAndCache3dModelUrl, type Cached3dModelResult } from '../../../lib/media-cache';
import type { ProductColorOption } from '../../../types/product';
import {
  clampProduct3dTargetAndCamera,
  computeProduct3dCameraBounds,
  ensureInitialPoseWithinBounds,
  type Product3dCameraBounds,
} from './product-3d-limits';
import {
  createModelAppearanceController,
  type MaterialAppearanceOptions,
  type ModelAppearanceController,
} from './product-3d-materials';

export interface Product3dViewerProps {
  src: string;
  productName: string;
  isActive: boolean;
  selectedColor?: ProductColorOption;
  finishLabel?: string;
  onClose?: () => void;
}

type ViewerStatus = 'loading' | 'ready' | 'error' | 'unsupported';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const FIRST_PERSON_FOV = 54;

const _probeVec = new THREE.Vector3();

function probeWebGlCapabilities(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') {
    return { supported: false, isSoftwareGl: true };
  }
  const probeCanvas = document.createElement('canvas');
  const gl2 = probeCanvas.getContext('webgl2');
  const gl = gl2 ?? probeCanvas.getContext('webgl');
  if (!gl) {
    return { supported: false, isSoftwareGl: true };
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const rendererName = String(gl.getParameter(param) ?? '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
  return { supported: true, isSoftwareGl };
}

function getStudioBackgroundHex(): number {
  if (typeof document === 'undefined') return 0xf4f2ed;
  return document.documentElement.classList.contains('dark') ? 0x18181b : 0xf4f2ed;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.06,
      size / 2,
      size / 2,
      size * 0.5
    );
    gradient.addColorStop(0, 'rgba(20, 18, 15, 0.42)');
    gradient.addColorStop(0.55, 'rgba(20, 18, 15, 0.14)');
    gradient.addColorStop(1, 'rgba(20, 18, 15, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function detectOpenFrontDirection(model: THREE.Object3D): {
  horizontalDir: THREE.Vector3;
  hasOpenCorner: boolean;
} {
  const quadrants = [
    { key: 'pp', x: 0.68, z: 0.73, count: 0 },
    { key: 'np', x: -0.68, z: 0.73, count: 0 },
    { key: 'nn', x: -0.68, z: -0.73, count: 0 },
    { key: 'pn', x: 0.68, z: -0.73, count: 0 },
  ];

  model.updateMatrixWorld(true);
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const posAttr = mesh.geometry.getAttribute('position');
    if (!posAttr || posAttr.count === 0) return;

    const step = Math.max(1, Math.floor(posAttr.count / 240));
    for (let i = 0; i < posAttr.count; i += step) {
      _probeVec.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      if (_probeVec.x >= 0 && _probeVec.z >= 0) quadrants[0].count += 1;
      else if (_probeVec.x < 0 && _probeVec.z >= 0) quadrants[1].count += 1;
      else if (_probeVec.x < 0 && _probeVec.z < 0) quadrants[2].count += 1;
      else quadrants[3].count += 1;
    }
  });

  let minQuad = quadrants[0];
  let maxQuad = quadrants[0];
  for (const quad of quadrants) {
    if (quad.count < minQuad.count) minQuad = quad;
    if (quad.count > maxQuad.count) maxQuad = quad;
  }

  if (maxQuad.count > 0 && minQuad.count <= maxQuad.count * 0.16) {
    return {
      horizontalDir: new THREE.Vector3(minQuad.x, 0, minQuad.z).normalize(),
      hasOpenCorner: true,
    };
  }

  return {
    horizontalDir: new THREE.Vector3(0.22, 0, 0.975).normalize(),
    hasOpenCorner: false,
  };
}

function disposeObjectSubtree(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const mat of materials) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
      mat.dispose();
    }
  });
}

export function Product3dViewer({
  src,
  productName,
  isActive,
  selectedColor,
  finishLabel,
  onClose,
}: Product3dViewerProps) {
  const activeColor = selectedColor ?? DEFAULT_UNIVERSAL_COLOR;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const resetCameraFnRef = useRef<(() => void) | null>(null);
  const requestRenderFnRef = useRef<(() => void) | null>(null);
  const appearanceControllerRef = useRef<ModelAppearanceController | null>(null);
  const appearanceRef = useRef<MaterialAppearanceOptions>({
    color: activeColor,
    finishLabel,
  });

  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setProgressPct(null);
    setErrorDetail('');
    setReloadNonce((prev) => prev + 1);
  }, []);

  const handleResetView = useCallback(() => {
    resetCameraFnRef.current?.();
  }, []);

  useEffect(() => {
    appearanceRef.current = { color: activeColor, finishLabel };
    if (appearanceControllerRef.current) {
      appearanceControllerRef.current.apply(appearanceRef.current);
      requestRenderFnRef.current?.();
    }
  }, [activeColor, finishLabel]);

  useEffect(() => {
    if (isActive) {
      requestRenderFnRef.current?.();
    }
  }, [isActive]);

  useEffect(() => {
    const container = containerRef.current;
    const mountEl = canvasMountRef.current;
    if (!container || !mountEl) return;

    const { supported, isSoftwareGl } = probeWebGlCapabilities();
    if (!supported) {
      setStatus('unsupported');
      return;
    }

    let disposed = false;
    let frameId = 0;
    let pollTimeoutId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let isUpdatingControls = false;
    let resetTransitionActive = false;
    let lastTransitionMs = 0;

    setStatus('loading');
    setProgressPct(null);
    setErrorDetail('');

    const width = Math.max(1, mountEl.clientWidth);
    const height = Math.max(1, mountEl.clientHeight);
    const initialBg = getStudioBackgroundHex();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.Fog(initialBg, 11, 30);

    const camera = new THREE.PerspectiveCamera(FIRST_PERSON_FOV, width / height, 0.04, 65);
    const firstPersonPos = new THREE.Vector3(-1.4, 1.42, 1.6);
    const firstPersonTarget = new THREE.Vector3(0, 0.94, 0);
    camera.position.copy(firstPersonPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setStatus('unsupported');
      return;
    }

    const capabilities = getDeviceCapabilities();
    const { maxDpr, shadowMapSize, maxAnisotropy } = getThreeDQualityProfile({
      isSoftwareGl,
      isCoarsePointer: capabilities.isCoarsePointer,
      isLowEndDevice: capabilities.isLowEndDevice,
      hardwareMaxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) {
        setErrorDetail('Konteks grafis 3D terputus sementara pada perangkat.');
        setStatus('error');
      }
    };
    const handleContextRestored = () => {
      if (!disposed) {
        requestRender();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRenderTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xe4ecf7, 0xcabaa5, 0.88);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.15);
    keyLight.position.set(4.5, 6.5, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -2.6;
    keyLight.shadow.camera.right = 2.6;
    keyLight.shadow.camera.top = 2.6;
    keyLight.shadow.camera.bottom = -2.6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe8f0ff, 0.72);
    rimLight.position.set(-4.2, 3.8, -3.6);
    scene.add(rimLight);

    const contactShadowTexture = createContactShadowTexture();
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    });
    const contactShadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const contactShadowPlane = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowPlane.rotation.x = -Math.PI / 2;
    contactShadowPlane.position.y = -0.02;
    scene.add(contactShadowPlane);

    const shadowCatcherGeo = new THREE.PlaneGeometry(8, 8);
    const shadowCatcherMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const shadowCatcherPlane = new THREE.Mesh(shadowCatcherGeo, shadowCatcherMat);
    shadowCatcherPlane.rotation.x = -Math.PI / 2;
    shadowCatcherPlane.position.y = 0;
    shadowCatcherPlane.receiveShadow = !isSoftwareGl;
    scene.add(shadowCatcherPlane);

    let activeBounds: Product3dCameraBounds = computeProduct3dCameraBounds({
      defaultPos: firstPersonPos,
      defaultTarget: firstPersonTarget,
      boundingRadius: 1.4,
      scaledHeight: 1.5,
    });

    const applyBoundsToControls = (
      orbit: OrbitControls,
      targetPoint: THREE.Vector3,
      bounds: Product3dCameraBounds
    ) => {
      orbit.minDistance = bounds.minDistance;
      orbit.maxDistance = bounds.maxDistance;
      orbit.minPolarAngle = bounds.minPolarAngle;
      orbit.maxPolarAngle = bounds.maxPolarAngle;
      orbit.minAzimuthAngle = bounds.minAzimuthAngle;
      orbit.maxAzimuthAngle = bounds.maxAzimuthAngle;
      orbit.cursor.copy(targetPoint);
      orbit.maxTargetRadius = bounds.maxTargetRadius;
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(firstPersonTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = false;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.8;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    applyBoundsToControls(controls, firstPersonTarget, activeBounds);
    controls.update();

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = renderer.getContext();
      if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const syncState = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (syncState === gl.UNSIGNALED) {
            pollTimeoutId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            pollTimeoutId = window.setTimeout(cb, 80);
          }
        };
        pollTimeoutId = window.setTimeout(poll, 5);
      } else {
        pollTimeoutId = window.setTimeout(cb, 80);
      }
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame(() => {
        if (disposed) {
          renderBusy = false;
          return;
        }
        renderDirty = false;

        if (resetTransitionActive) {
          const now = performance.now();
          const dt = lastTransitionMs > 0 ? Math.min(0.05, (now - lastTransitionMs) / 1000) : 0.016;
          lastTransitionMs = now;
          const factor = 1 - Math.exp(-8.5 * dt);

          camera.position.lerp(firstPersonPos, factor);
          controls.target.lerp(firstPersonTarget, factor);

          if (
            camera.position.distanceToSquared(firstPersonPos) < 0.0002 &&
            controls.target.distanceToSquared(firstPersonTarget) < 0.0002
          ) {
            camera.position.copy(firstPersonPos);
            controls.target.copy(firstPersonTarget);
            resetTransitionActive = false;
            lastTransitionMs = 0;
          }
        }

        isUpdatingControls = true;
        const controlsMoved = controls.update();
        clampProduct3dTargetAndCamera(camera, controls.target, activeBounds);
        isUpdatingControls = false;

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (!disposed && modelFirstFramePending) {
            modelFirstFramePending = false;
            setStatus('ready');
          }
          if (
            !disposed &&
            (renderDirty || resetTransitionActive || (controlsMoved && !isSoftwareGl))
          ) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    };

    requestRenderFnRef.current = requestRender;
    resetCameraFnRef.current = () => {
      if (isSoftwareGl) {
        resetTransitionActive = false;
        camera.position.copy(firstPersonPos);
        controls.target.copy(firstPersonTarget);
        controls.update();
        clampProduct3dTargetAndCamera(camera, controls.target, activeBounds);
        requestRender();
        return;
      }
      resetTransitionActive = true;
      lastTransitionMs = performance.now();
      requestRender();
    };

    const handleControlStart = () => {
      resetTransitionActive = false;
      lastTransitionMs = 0;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const handleControlEnd = () => {
      renderer.domElement.style.cursor = 'grab';
    };
    const handleControlChange = () => {
      if (!isUpdatingControls) {
        requestRender();
      }
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);
    controls.addEventListener('change', handleControlChange);

    THREE.Cache.enabled = true;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setCrossOrigin('anonymous');
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    let loadedModelGroup: THREE.Object3D | null = null;
    let modelFirstFramePending = false;
    let activeCachedModel: Cached3dModelResult | null = null;

    const loadGltfFromUrl = (resolvedModelUrl: string) => {
      gltfLoader.load(
        resolvedModelUrl,
        (gltf) => {
          activeCachedModel?.revoke();
          activeCachedModel = null;

          if (disposed) {
            disposeObjectSubtree(gltf.scene);
            return;
          }

          const model = gltf.scene;
          const rawBox = new THREE.Box3().setFromObject(model);
          const rawSize = new THREE.Vector3();
          rawBox.getSize(rawSize);
          const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
          const normScale = 2.2 / maxDim;
          model.scale.setScalar(normScale);
          model.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledSize = new THREE.Vector3();
          const scaledCenter = new THREE.Vector3();
          scaledBox.getSize(scaledSize);
          scaledBox.getCenter(scaledCenter);

          model.position.x -= scaledCenter.x;
          model.position.z -= scaledCenter.z;
          model.position.y -= scaledBox.min.y - 0.001;

          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = !isSoftwareGl;

            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material
                ? [mesh.material]
                : [];
            for (const mat of mats) {
              if (!mat) continue;
              for (const value of Object.values(mat)) {
                if (value instanceof THREE.Texture) {
                  value.anisotropy = maxAnisotropy;
                }
              }
            }
          });

          const contactScale = Math.max(
            0.6,
            Math.min(1.65, Math.max(scaledSize.x, scaledSize.z) * 0.74)
          );
          contactShadowPlane.scale.set(contactScale, contactScale, 1);

          const sphere = new THREE.Sphere();
          new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);

          const { horizontalDir, hasOpenCorner } = detectOpenFrontDirection(model);

          const eyeHeight = Math.max(0.65, scaledSize.y * (hasOpenCorner ? 0.71 : 0.64));
          const fpLookY = Math.max(0.28, scaledSize.y * (hasOpenCorner ? 0.48 : 0.44));
          firstPersonTarget.set(0, fpLookY, 0);

          const fpDist = Math.max(
            1.35,
            sphere.radius * (hasOpenCorner ? 1.52 : 1.76)
          );
          firstPersonPos.set(
            horizontalDir.x * fpDist,
            eyeHeight,
            horizontalDir.z * fpDist
          );

          activeBounds = computeProduct3dCameraBounds({
            defaultPos: firstPersonPos,
            defaultTarget: firstPersonTarget,
            boundingRadius: sphere.radius,
            scaledHeight: scaledSize.y,
          });
          ensureInitialPoseWithinBounds(firstPersonPos, firstPersonTarget, activeBounds);

          camera.fov = FIRST_PERSON_FOV;
          camera.updateProjectionMatrix();
          camera.position.copy(firstPersonPos);
          controls.target.copy(firstPersonTarget);
          applyBoundsToControls(controls, firstPersonTarget, activeBounds);
          controls.update();
          clampProduct3dTargetAndCamera(camera, controls.target, activeBounds);

          const appearanceController = createModelAppearanceController(model, maxAnisotropy);
          appearanceController.apply(appearanceRef.current);
          appearanceControllerRef.current = appearanceController;

          loadedModelGroup = model;
          scene.add(model);
          modelFirstFramePending = true;

          if (!isSoftwareGl) {
            renderer.compile(scene, camera);
          }

          requestRender();
        },
        (progressEvent) => {
          if (disposed) return;
          if (progressEvent.lengthComputable && progressEvent.total > 0) {
            const pct = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
            setProgressPct(pct);
          }
        },
        () => {
          activeCachedModel?.revoke();
          activeCachedModel = null;
          if (disposed) return;
          setErrorDetail('File .glb tidak dapat diakses atau belum mendukung CORS.');
          setStatus('error');
        }
      );
    };

    void loadAndCache3dModelUrl(src, (pct) => {
      if (!disposed) {
        setProgressPct(pct);
      }
    }).then((cachedResult) => {
      if (disposed) {
        cachedResult?.revoke();
        return;
      }
      if (cachedResult) {
        activeCachedModel = cachedResult;
        loadGltfFromUrl(cachedResult.objectUrl);
      } else {
        loadGltfFromUrl(src);
      }
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (disposed) return;
            const nextW = Math.max(1, mountEl.clientWidth);
            const nextH = Math.max(1, mountEl.clientHeight);
            camera.aspect = nextW / nextH;
            camera.updateProjectionMatrix();
            renderer.setSize(nextW, nextH, false);
            requestRender();
          })
        : null;
    resizeObserver?.observe(mountEl);

    const themeObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            if (disposed) return;
            const nextBg = getStudioBackgroundHex();
            (scene.background as THREE.Color).setHex(nextBg);
            if (scene.fog instanceof THREE.Fog) {
              scene.fog.color.setHex(nextBg);
            }
            requestRender();
          })
        : null;
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    requestRender();

    return () => {
      disposed = true;
      activeCachedModel?.revoke();
      activeCachedModel = null;
      resetCameraFnRef.current = null;
      requestRenderFnRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(pollTimeoutId);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();
      dracoLoader.dispose();
      appearanceControllerRef.current?.dispose();
      appearanceControllerRef.current = null;
      if (loadedModelGroup) {
        scene.remove(loadedModelGroup);
        disposeObjectSubtree(loadedModelGroup);
      }
      scene.remove(contactShadowPlane, shadowCatcherPlane);
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      contactShadowTexture.dispose();
      shadowCatcherGeo.dispose();
      shadowCatcherMat.dispose();
      envRenderTarget.dispose();
      renderer.dispose();
      mountEl.innerHTML = '';
    };
  }, [src, reloadNonce]);

  return (
    <div
      ref={containerRef}
      data-testid="detail-3d-viewer"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="relative size-full overflow-hidden bg-[var(--surface-muted)] select-none"
      aria-label={`Pratinjau model 3D interaktif ${productName}`}
    >
      <div
        ref={canvasMountRef}
        className="size-full touch-none cursor-grab active:cursor-grabbing"
      />

      <div
        data-testid="detail-3d-color-badge"
        className="pointer-events-none absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1 text-[11px] font-medium text-[var(--text)] shadow-xs max-w-[calc(100%-5.5rem)]"
      >
        <Box className="size-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
        <span className="shrink-0">3D Interaktif</span>
        <span aria-hidden="true" className="text-[var(--border-strong)] shrink-0">
          ·
        </span>
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full border border-[var(--border-strong)] shrink-0"
          style={{ backgroundColor: activeColor.hex }}
        />
        <span className="truncate">{activeColor.nama}</span>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        {status === 'ready' && (
          <button
            type="button"
            data-testid="detail-3d-reset-button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleResetView();
            }}
            aria-label="Reset sudut kamera 3D"
            title="Reset sudut kamera 3D"
            className="inline-flex items-center justify-center size-7 sm:size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--text)] hover:bg-[var(--surface-muted)] shadow-xs cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            data-testid="detail-3d-close-button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Tutup tampilan 3D"
            title="Tutup tampilan 3D"
            className="inline-flex items-center justify-center size-7 sm:size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--text)] hover:bg-[var(--surface-muted)] shadow-xs cursor-pointer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--surface-muted)]/92 p-4 text-center">
          <BrandRingLoader
            size="md"
            progressPct={progressPct}
            delayMs={0}
            label={
              progressPct !== null ? `Memuat model 3D (${progressPct}%)` : 'Memuat model 3D (.glb)...'
            }
          />
        </div>
      )}

      {(status === 'error' || status === 'unsupported') && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-[var(--surface)] p-5 text-center">
          <Box className="size-6 text-[var(--text-muted)]" aria-hidden="true" />
          <div className="space-y-1 max-w-xs">
            <p className="text-xs font-semibold text-[var(--text)]">
              {status === 'unsupported'
                ? 'Pratinjau 3D WebGL tidak didukung di browser ini'
                : 'Gagal memuat model 3D'}
            </p>
            {errorDetail && (
              <p className="text-[11px] text-[var(--text-muted)]">{errorDetail}</p>
            )}
          </div>
          {status === 'error' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--border-strong)] cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Coba Lagi</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
