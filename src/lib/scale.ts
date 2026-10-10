import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// TV design base was 1920x1080, but using 1440 provides a better, slightly larger scale
const DESIGN_WIDTH = 1440;

/**
 * Scale a size based on the actual window width compared to the 1920px design.
 * This ensures UI elements look identical on TVs regardless of their density setting.
 */
export const scale = (size: number): number => {
  return Math.round((width / DESIGN_WIDTH) * size);
};
