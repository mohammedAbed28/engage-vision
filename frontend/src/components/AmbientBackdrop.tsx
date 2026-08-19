import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppearance } from "../context/AppearanceContext";

/** Lightweight layered background that gives every screen a coherent 3D
 * atmosphere while remaining fast on older Android devices. */
export default function AmbientBackdrop() {
  const { brighter } = useAppearance();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      <LinearGradient
        colors={brighter ? ["#172637", "#20384B", "#111D2B"] : ["#0B1017", "#14202B", "#0C1118"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbOne, brighter && styles.orbOneBright]} />
      <View style={[styles.orb, styles.orbTwo, brighter && styles.orbTwoBright]} />
      <View style={[styles.orb, styles.orbThree, brighter && styles.orbThreeBright]} />
      <View style={styles.depthPlane} />
      <View style={styles.gridLineOne} />
      <View style={styles.gridLineTwo} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  orb: { position: "absolute", borderRadius: 999 },
  orbOne: {
    width: 280, height: 280, top: -165, right: -120,
    backgroundColor: "rgba(75,168,255,0.16)",
    transform: [{ scaleX: 1.2 }],
  },
  orbOneBright: { backgroundColor: "rgba(75,168,255,0.24)" },
  orbTwo: {
    width: 250, height: 250, bottom: -80, left: -170,
    backgroundColor: "rgba(232,197,143,0.11)",
  },
  orbTwoBright: { backgroundColor: "rgba(232,197,143,0.18)" },
  orbThree: {
    width: 140, height: 140, top: "42%", right: -100,
    backgroundColor: "rgba(255,128,107,0.075)",
  },
  orbThreeBright: { backgroundColor: "rgba(255,128,107,0.12)" },
  depthPlane: {
    position: "absolute", width: 340, height: 150, top: "28%", right: -210,
    borderRadius: 44, borderWidth: 1, borderColor: "rgba(232,197,143,0.08)",
    backgroundColor: "rgba(232,197,143,0.035)", transform: [{ rotate: "-24deg" }],
  },
  gridLineOne: {
    position: "absolute", width: 500, height: 1, top: "43%", left: -90,
    backgroundColor: "rgba(75,168,255,0.06)", transform: [{ rotate: "-17deg" }],
  },
  gridLineTwo: {
    position: "absolute", width: 500, height: 1, top: "60%", left: -70,
    backgroundColor: "rgba(255,128,107,0.05)", transform: [{ rotate: "-17deg" }],
  },
});
