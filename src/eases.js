// The two custom eases the reference names and reuses across sections.
import { gsap } from './reveal.js';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

export const SILK = CustomEase.create('cinematicSilk', '0.45, 0.05, 0.55, 0.95');
export const SMOOTH = CustomEase.create('cinematicSmooth', '0.25, 0.1, 0.25, 1');
