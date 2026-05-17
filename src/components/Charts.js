// Lightweight charts built on react-native-svg + plain Views.
// Replaces the ApexCharts used in the web app.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/theme';

// Circular progress gauge — used for battery % and prediction %.
export function CircularGauge({ percent, size = 170, stroke = 14, color = colors.c2, value, label }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamped / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.19, fontWeight: '800', color: colors.navy }}>
        {value != null ? value : `${Math.round(clamped)}%`}
      </Text>
      {label ? <Text style={{ fontSize: 12, color: colors.text3, marginTop: 2 }}>{label}</Text> : null}
    </View>
  );
}

function barColor(v) {
  if (v >= 85) return colors.red;
  if (v >= 55) return colors.c2;
  return colors.c3;
}

// Vertical bar chart — used for the hourly demand forecast.
export function BarChart({ labels, data, height = 150 }) {
  const max = Math.max(...data, 1);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
        {data.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                width: '58%',
                height: Math.max(2, (v / max) * height),
                backgroundColor: barColor(v),
                borderRadius: 4,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text key={i} style={s.axisLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

// Area / line chart — used for energy consumption.
export function AreaChart({ data, labels, height = 130, color = colors.c2 }) {
  const [w, setW] = useState(0);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const n = data.length;
  const padV = 8;

  let line = '';
  let area = '';
  if (w > 0) {
    const pts = data.map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = height - padV - ((v - min) / range) * (height - padV * 2);
      return [x, y];
    });
    line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    area = `${line} L${w.toFixed(1)} ${height} L0 ${height} Z`;
  }

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.32" />
              <Stop offset="1" stopColor={color} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#areaGrad)" />
          <Path d={line} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      {labels ? (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {labels.map((l, i) => (
            <Text key={i} style={s.axisLabel}>{l}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 9, color: colors.text3 },
});
