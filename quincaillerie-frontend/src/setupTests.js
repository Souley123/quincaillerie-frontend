import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Compatibilité avec les tests existants écrits pour Jest.
globalThis.jest = vi;
