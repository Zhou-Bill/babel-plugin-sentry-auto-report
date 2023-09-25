import * as fs from 'fs'
import * as path from 'path'
import autoReportPlugin from "babel-plugin-catch-auto-report"

import { transformFileSync } from '@babel/core'
const examplePath = path.resolve(__dirname, './example.js')
console.log(examplePath)

const result = transformFileSync(path.resolve(process.cwd(), 'example.js'), {
  plugins: [[autoReportPlugin, {
    outputDir: path.resolve(__dirname, './output')
  }]]
})

console.log(result?.code?.toString())