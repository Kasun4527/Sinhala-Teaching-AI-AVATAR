"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// ── Rhubarb viseme → OVR viseme morph target mapping ──────────────────────
const RHUBARB_TO_VISEME = {
  A: "viseme_PP", B: "viseme_SS", C: "viseme_E",  D: "viseme_aa",
  E: "viseme_O",  F: "viseme_U",  G: "viseme_FF", H: "viseme_DD", X: "viseme_sil",
};

const CLIP_FILES = {
  talk:      "/models/new_avatar_talking.fbx",
  talk1:     "/models/new_avatar_talking_1.fbx",
  talk2:     "/models/new_avatar_talking_2.fbx",
  talk3:     "/models/new_avatar_talking_3.fbx",
  walkStart: "/models/new_avatar_walking_start.fbx",
  waveStart: "/models/new_avatar_waving_start.fbx",
  waveEnd:   "/models/new_avatar_waving_2.fbx",
};

const SPEAKING_FLOW = [
  "talk", "idle", "talk1", "idle", "talk2", "idle",
  "idle", "idle", "talk3", "idle",
];
const LOOP_INSERT_SECONDS = { idle: 2.5 };

function findSegment(timeline, t, hintIndex) {
  if (!timeline || timeline.length === 0) return null;
  let i = Math.min(Math.max(hintIndex, 0), timeline.length - 1);
  while (i > 0 && timeline[i].start > t) i--;
  while (i < timeline.length - 1 && timeline[i].end <= t) i++;
  return timeline[i];
}

// ── Inner avatar mesh (runs inside Canvas) ─────────────────────────────────
const AvatarMesh = forwardRef(function AvatarMesh({ speaking, audioRef, timelineRef }, ref) {
  const groupRef = useRef();
  const [, setReady] = useState(false);

  const state = useRef({
    mixer: null, actions: {}, currentName: "",
    morphMesh: null, visemeIndex: {}, jawOpenIndex: -1,
    segmentIndex: 0, phase: "idle", phaseTimer: 0,
    wasSpeaking: false, flowIndex: 0,
  }).current;

  function playAction(name, fadeTime = 0.4) {
    const next = state.actions[name];
    if (!next || state.currentName === name) return;
    next.reset().play();
    if (state.actions[state.currentName]) {
      state.actions[state.currentName].crossFadeTo(next, fadeTime, true);
    }
    state.currentName = name;
  }

  function stopImmediately() {
    state.phase = "idle";
    state.wasSpeaking = false;
    playAction("idle");
  }

  useImperativeHandle(ref, () => ({ playAction, stopImmediately }), []);

  useEffect(() => {
    let disposed = false;
    const loader = new FBXLoader();
    loader.load("/models/new avatar_Idle.fbx", (fbx) => {
      if (disposed) return;
      const box = new THREE.Box3().setFromObject(fbx);
      fbx.scale.setScalar(1.7 / (box.max.y - box.min.y));
      fbx.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(fbx);
      fbx.position.y -= box2.min.y;
      groupRef.current.add(fbx);

      fbx.traverse((c) => {
        if (c.isMesh && c.morphTargetDictionary && !state.morphMesh) {
          state.morphMesh = c;
          for (const visemeName of Object.values(RHUBARB_TO_VISEME)) {
            if (c.morphTargetDictionary[visemeName] !== undefined) {
              state.visemeIndex[visemeName] = c.morphTargetDictionary[visemeName];
            }
          }
          if (c.morphTargetDictionary.jawOpen !== undefined) {
            state.jawOpenIndex = c.morphTargetDictionary.jawOpen;
          }
        }
      });

      const mixer = new THREE.AnimationMixer(fbx);
      state.mixer = mixer;
      if (fbx.animations?.[0]) {
        state.actions.idle = mixer.clipAction(fbx.animations[0]);
        state.actions.idle.play();
        state.currentName = "idle";
      }

      Object.entries(CLIP_FILES).forEach(([name, path]) => {
        new FBXLoader().load(path, (clipFbx) => {
          if (disposed || !clipFbx.animations?.[0]) return;
          state.actions[name] = mixer.clipAction(clipFbx.animations[0]);
        });
      });

      setReady(true);
    });
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    if (state.mixer) state.mixer.update(dt);

    const getDuration = (name) => state.actions[name]?.getClip().duration ?? 2;

    if (speaking && !state.wasSpeaking) {
      state.phase = "wavingStart"; state.phaseTimer = 0; playAction("waveStart");
    } else if (!speaking && state.wasSpeaking) {
      state.phase = "wavingEnd"; state.phaseTimer = 0; playAction("waveEnd");
    }
    state.wasSpeaking = speaking;
    state.phaseTimer += dt;

    if (state.phase === "wavingStart") {
      if (state.phaseTimer > getDuration("waveStart")) {
        state.phase = "flow"; state.phaseTimer = 0; state.flowIndex = 0;
        playAction(SPEAKING_FLOW[0]);
      }
    } else if (state.phase === "flow") {
      const name = SPEAKING_FLOW[state.flowIndex];
      const segDur = LOOP_INSERT_SECONDS[name] ?? getDuration(name);
      if (state.phaseTimer > segDur) {
        state.phaseTimer = 0;
        state.flowIndex = (state.flowIndex + 1) % SPEAKING_FLOW.length;
        playAction(SPEAKING_FLOW[state.flowIndex]);
      }
    } else if (state.phase === "wavingEnd") {
      if (state.phaseTimer > getDuration("waveEnd")) {
        state.phase = "idle"; playAction("idle");
      }
    }

    if (!state.morphMesh) return;

    const timeline = timelineRef?.current;
    const audioEl  = audioRef?.current;
    let viseme = "X";
    if (speaking && timeline && timeline.length > 0 && audioEl) {
      const seg = findSegment(timeline, audioEl.currentTime, state.segmentIndex);
      state.segmentIndex = timeline.indexOf(seg);
      viseme = seg?.viseme || "X";
    }
    const targetMorph = RHUBARB_TO_VISEME[viseme] || "viseme_sil";
    const influences  = state.morphMesh.morphTargetInfluences;
    for (const [name, idx] of Object.entries(state.visemeIndex)) {
      const target = name === targetMorph ? 1 : 0;
      influences[idx] += (target - influences[idx]) * Math.min(1, 22 * dt);
    }
    if (state.jawOpenIndex >= 0) {
      const jawTarget = viseme === "X" ? 0 : 0.25;
      influences[state.jawOpenIndex] += (jawTarget - influences[state.jawOpenIndex]) * Math.min(1, 22 * dt);
    }
  });

  return <group ref={groupRef} />;
});

// ── Exported canvas wrapper ────────────────────────────────────────────────
export default function Avatar3DCanvas({ avatarRef, audioRef, timelineRef, speaking }) {
  return (
    <Canvas shadows camera={{ position: [0, 1.5, 3.5], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={2.5} />
      <directionalLight position={[3, 8, 5]} intensity={2} castShadow />
      <directionalLight position={[-4, 4, -3]} intensity={1} color="#c9d8ff" />
      <directionalLight position={[0, 3, 5]} intensity={1.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a2744" />
      </mesh>
      <AvatarMesh
        ref={avatarRef}
        speaking={speaking}
        audioRef={audioRef}
        timelineRef={timelineRef}
      />
      <OrbitControls target={[0, 1.0, 0]} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
