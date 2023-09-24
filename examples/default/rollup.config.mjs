import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: './index.ts',
  output: [
    {
      file: 'index.js',
      format: 'cjs',
    },
  ],
  external: ['@babel/types', '@babel/helper-plugin-utils', '@babel/core',  '@babel/template'],
  plugins: [
    resolve(), 
    commonjs(), 
    typescript({
      module: 'esnext'
    }), 
    json()
  ]
}