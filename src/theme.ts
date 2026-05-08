import { createTheme, MantineColorsTuple } from '@mantine/core';

const paleBlue: MantineColorsTuple = [
  '#eef3ff',
  '#dce4f5',
  '#b9c7e2',
  '#94a8d0',
  '#748dc1',
  '#5f7cb8',
  '#5474b4',
  '#44639f',
  '#39588f',
  '#2d4b81',
];
export const theme = createTheme({
  defaultRadius: 'md',
  // The paleBlue tuple was previously defined but never wired up, so every
  // Mantine "primary" component fell back to the default Mantine blue
  // (#228be6) — clashing with the dashboard's #2a2d43 chrome and making the
  // whole app feel like two different products glued together. Setting it as
  // the primary color cascades through every Button/Switch/Pagination/etc.
  // and into chat-inject's var(--mantine-primary-color-filled) lookups.
  primaryColor: 'paleBlue',
  colors: {
    paleBlue,
  },
});
