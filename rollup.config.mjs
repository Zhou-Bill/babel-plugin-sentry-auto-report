import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: './src/index.ts',
  output: [
    {
      file: 'libs/bundle.js',
      format: 'cjs',
    },
    {
      file: 'es/bundle.esm.js',
      format: 'esm',
    }
  ],
  plugins: [resolve(), commonjs(), typescript()]
}