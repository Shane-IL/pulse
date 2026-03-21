// Dark theme (Catppuccin-inspired) — all inline style objects

export const colors = {
  base: '#1e1e2e',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  blue: '#89b4fa',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  teal: '#94e2d5',
  peach: '#fab387',
};

export const panelRoot: Record<string, string> = {
  position: 'fixed',
  bottom: '0',
  left: '0',
  right: '0',
  height: '320px',
  backgroundColor: colors.base,
  color: colors.text,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: '12px',
  lineHeight: '1.5',
  zIndex: '2147483647',
  display: 'flex',
  flexDirection: 'column',
  borderTop: `2px solid ${colors.mauve}`,
  overflow: 'hidden',
};

export const tabBar: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: colors.surface0,
  borderBottom: `1px solid ${colors.surface1}`,
  padding: '0 8px',
  height: '32px',
  flexShrink: '0',
};

export const tabButton = (active: boolean): Record<string, string> => ({
  background: 'none',
  border: 'none',
  color: active ? colors.mauve : colors.subtext0,
  fontFamily: 'inherit',
  fontSize: '12px',
  padding: '6px 12px',
  cursor: 'pointer',
  borderBottom: active ? `2px solid ${colors.mauve}` : '2px solid transparent',
  marginBottom: '-1px',
});

export const closeButton: Record<string, string> = {
  background: 'none',
  border: 'none',
  color: colors.overlay0,
  fontSize: '16px',
  cursor: 'pointer',
  marginLeft: 'auto',
  padding: '4px 8px',
  fontFamily: 'inherit',
};

export const tabContent: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '8px 12px',
};

export const splitPane: Record<string, string> = {
  display: 'flex',
  height: '100%',
  gap: '1px',
};

export const paneLeft: Record<string, string> = {
  width: '200px',
  flexShrink: '0',
  borderRight: `1px solid ${colors.surface1}`,
  overflow: 'auto',
  padding: '4px 0',
};

export const paneRight: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '8px',
};

export const storeItem = (selected: boolean): Record<string, string> => ({
  padding: '4px 12px',
  cursor: 'pointer',
  backgroundColor: selected ? colors.surface1 : 'transparent',
  color: selected ? colors.blue : colors.text,
});

export const treeKey: Record<string, string> = {
  color: colors.mauve,
};

export const treeValue: Record<string, string> = {
  color: colors.green,
};

export const treeString: Record<string, string> = {
  color: colors.yellow,
};

export const treeBool: Record<string, string> = {
  color: colors.peach,
};

export const treeNull: Record<string, string> = {
  color: colors.overlay0,
  fontStyle: 'italic',
};

export const actionEntry = (active: boolean): Record<string, string> => ({
  padding: '4px 8px',
  cursor: 'pointer',
  backgroundColor: active ? colors.surface1 : 'transparent',
  borderLeft: active ? `3px solid ${colors.blue}` : '3px solid transparent',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

export const actionName: Record<string, string> = {
  color: colors.blue,
  fontWeight: 'bold',
};

export const actionTime: Record<string, string> = {
  color: colors.overlay0,
  fontSize: '10px',
};

export const slider: Record<string, string> = {
  width: '100%',
  accentColor: colors.mauve,
  margin: '4px 0 8px',
};

export const filterInput: Record<string, string> = {
  width: '100%',
  backgroundColor: colors.surface0,
  border: `1px solid ${colors.surface1}`,
  color: colors.text,
  padding: '4px 8px',
  fontFamily: 'inherit',
  fontSize: '12px',
  borderRadius: '4px',
  outline: 'none',
  marginBottom: '8px',
  boxSizing: 'border-box',
};

export const componentItem: Record<string, string> = {
  padding: '4px 8px',
  borderBottom: `1px solid ${colors.surface0}`,
};

export const componentName: Record<string, string> = {
  color: colors.teal,
  fontWeight: 'bold',
};

export const componentStores: Record<string, string> = {
  color: colors.overlay0,
  fontSize: '10px',
  marginLeft: '8px',
};

export const badge: Record<string, string> = {
  display: 'inline-block',
  backgroundColor: colors.surface1,
  color: colors.subtext0,
  padding: '1px 6px',
  borderRadius: '8px',
  fontSize: '10px',
  marginLeft: '4px',
};

export const title: Record<string, string> = {
  color: colors.mauve,
  fontWeight: 'bold',
  fontSize: '12px',
  marginRight: '8px',
};
