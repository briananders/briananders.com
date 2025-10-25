#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const webp = require('webp-converter');

// Import file format constants
const { webpCandidates } = require('../build/constants/file-formats');

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
const svgExtensions = ['.svg'];
const convertedFiles = [];
const modifiedFiles = [];

function findImageFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.log(`Directory ${dir} does not exist`);
    return files;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findImageFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (imageExtensions.includes(ext) && !svgExtensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function convertToWebP(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '.webp');
  
  // Skip if output already exists
  if (fs.existsSync(outputPath)) {
    console.log(`WebP already exists, skipping: ${outputPath}`);
    return null;
  }
  
  try {
    console.log(`Converting to WebP: ${inputPath} -> ${outputPath}`);
    webp.grant_permission();
    const result = webp.cwebp(inputPath, outputPath, '-q 80');
    console.log(`WebP conversion result: ${result}`);
    return outputPath;
  } catch (error) {
    console.error(`Failed to convert ${inputPath} to WebP:`, error.message);
    return null;
  }
}

function convertToAVIF(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '.avif');
  
  // Skip if output already exists
  if (fs.existsSync(outputPath)) {
    console.log(`AVIF already exists, skipping: ${outputPath}`);
    return null;
  }
  
  try {
    console.log(`Converting to AVIF: ${inputPath} -> ${outputPath}`);
    // Use avifenc with optimized settings
    execSync(`avifenc --min 0 --max 63 --speed 4 --yuv 420 "${inputPath}" "${outputPath}"`, { 
      stdio: 'pipe' 
    });
    console.log(`AVIF conversion successful: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Failed to convert ${inputPath} to AVIF:`, error.message);
    // Check if avifenc is available
    try {
      execSync('avifenc --version', { stdio: 'pipe' });
    } catch (versionError) {
      console.error('AVIF encoder (avifenc) is not available. Please install libavif-tools.');
    }
    return null;
  }
}

function shouldConvert(filePath) {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  return webpCandidates.includes(ext);
}

function main() {
  const srcDir = process.argv[2] || './src';
  console.log(`Looking for images in: ${srcDir}`);
  
  // Find all image files
  const imageFiles = findImageFiles(srcDir);
  console.log(`Found ${imageFiles.length} image files`);
  
  if (imageFiles.length === 0) {
    console.log('No image files found to convert');
    return;
  }
  
  // Process each image file
  for (const imageFile of imageFiles) {
    if (!shouldConvert(imageFile)) {
      console.log(`Skipping ${imageFile} - not a conversion candidate`);
      continue;
    }
    
    console.log(`\nProcessing: ${imageFile}`);
    
    const result = {
      original: imageFile,
      webp: null,
      avif: null
    };
    
    // Convert to WebP
    const webpPath = convertToWebP(imageFile);
    if (webpPath) {
      result.webp = webpPath;
      modifiedFiles.push(webpPath);
    }
    
    // Convert to AVIF
    const avifPath = convertToAVIF(imageFile);
    if (avifPath) {
      result.avif = avifPath;
      modifiedFiles.push(avifPath);
    }
    
    // Only add to converted files if we actually created new files
    if (result.webp || result.avif) {
      convertedFiles.push(result);
    }
  }
  
  // Write conversion results
  const results = {
    convertedFiles,
    modifiedFiles,
    timestamp: new Date().toISOString(),
    summary: {
      totalImages: imageFiles.length,
      convertedImages: convertedFiles.length,
      newFiles: modifiedFiles.length
    }
  };
  
  fs.writeFileSync('conversion-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n=== Conversion Summary ===');
  console.log(`Total images found: ${results.summary.totalImages}`);
  console.log(`Images with new conversions: ${results.summary.convertedImages}`);
  console.log(`New files created: ${results.summary.newFiles}`);
  console.log(`Results saved to: conversion-results.json`);
  
  if (convertedFiles.length > 0) {
    console.log('\nConverted files:');
    convertedFiles.forEach(file => {
      console.log(`  ${file.original}:`);
      if (file.webp) console.log(`    ✅ WebP: ${file.webp}`);
      if (file.avif) console.log(`    ✅ AVIF: ${file.avif}`);
    });
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  convertToWebP,
  convertToAVIF,
  findImageFiles,
  shouldConvert
};