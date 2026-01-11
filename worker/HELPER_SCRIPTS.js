/**
 * Helper Scripts for Geocoding Workflow
 * Location: worker/scripts/
 * 
 * These scripts assist with the export/geocode/import process for voters_addr_norm lat/lng
 */

// ════════════════════════════════════════════════════════════════════════════════
// SCRIPT 1: export_for_geocoding.js
// Purpose: Convert JSON export from D1 to CSV format
// Usage: node scripts/export_for_geocoding.js <input.json> <output.csv>
// ════════════════════════════════════════════════════════════════════════════════

/*
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || '../data/voters_addr_norm_to_geocode.json';
const outputFile = process.argv[3] || '../data/voters_addr_norm_to_geocode.csv';

console.log(`📥 Reading from: ${inputFile}`);
console.log(`📤 Writing to: ${outputFile}`);

try {
  // Read JSON file
  const rawData = fs.readFileSync(inputFile, 'utf-8');
  const voters = JSON.parse(rawData);
  
  if (!Array.isArray(voters)) {
    throw new Error('Input JSON is not an array');
  }
  
  console.log(`⏳ Processing ${voters.length} rows...`);
  
  // Create output stream
  const stream = fs.createWriteStream(outputFile);
  
  // Write header
  stream.write('voter_id,addr1,city,state,zip\n');
  
  // Write data rows with proper CSV escaping
  voters.forEach((row, index) => {
    if (!row.voter_id) {
      console.warn(`⚠️  Row ${index}: Missing voter_id, skipping`);
      return;
    }
    
    // Escape quotes in address (double them)
    const escapedAddr = (row.addr1 || '')
      .replace(/"/g, '""')
      .replace(/\n/g, ' ');
    
    const csv = `${row.voter_id},"${escapedAddr}",${row.city || ''},${row.state || ''},${row.zip || ''}\n`;
    stream.write(csv);
  });
  
  stream.end();
  
  stream.on('finish', () => {
    console.log(`✅ Export complete!`);
    console.log(`   File: ${outputFile}`);
    console.log(`   Rows: ${voters.length}`);
    console.log(`   Size: ${fs.statSync(outputFile).size} bytes`);
  });
  
  stream.on('error', (err) => {
    console.error(`❌ Write error: ${err.message}`);
    process.exit(1);
  });
  
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
*/

// ════════════════════════════════════════════════════════════════════════════════
// SCRIPT 2: split_for_census.js
// Purpose: Split large CSV into 10k row chunks for Census Batch Geocoder
// Usage: node scripts/split_for_census.js <input.csv> <output_dir>
// ════════════════════════════════════════════════════════════════════════════════

/*
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const inputFile = process.argv[2] || '../data/voters_addr_norm_to_geocode.csv';
const outputDir = process.argv[3] || '../data/batches';

const CHUNK_SIZE = 10000;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Created directory: ${outputDir}`);
}

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity
});

let currentChunk = 1;
let currentRows = 0;
let currentStream = null;
let headerLine = null;
let totalRows = 0;

function createNewChunk() {
  if (currentStream) currentStream.end();
  
  const chunkFile = path.join(outputDir, `batch_${String(currentChunk).padStart(3, '0')}.csv`);
  console.log(`📄 Creating chunk ${currentChunk}: ${chunkFile}`);
  
  currentStream = fs.createWriteStream(chunkFile);
  currentStream.write(headerLine + '\n');
  currentRows = 0;
  currentChunk++;
}

rl.on('line', (line) => {
  // First line is header
  if (headerLine === null) {
    headerLine = line;
    createNewChunk();
    return;
  }
  
  totalRows++;
  currentRows++;
  
  // Write to current chunk
  currentStream.write(line + '\n');
  
  // Create new chunk if limit reached
  if (currentRows >= CHUNK_SIZE) {
    createNewChunk();
  }
});

rl.on('close', () => {
  if (currentStream) currentStream.end();
  
  console.log(`\n✅ Splitting complete!`);
  console.log(`   Input file: ${inputFile}`);
  console.log(`   Total rows: ${totalRows}`);
  console.log(`   Chunks created: ${currentChunk - 1}`);
  console.log(`   Output directory: ${outputDir}`);
  console.log(`   Max chunk size: ${CHUNK_SIZE}`);
  
  // List created files
  const files = fs.readdirSync(outputDir).sort();
  console.log(`\n📋 Created files:`);
  files.forEach(f => {
    const filePath = path.join(outputDir, f);
    const size = fs.statSync(filePath).size;
    console.log(`   ${f} (${size} bytes)`);
  });
});

rl.on('error', (err) => {
  console.error(`❌ Read error: ${err.message}`);
  process.exit(1);
});
*/

// ════════════════════════════════════════════════════════════════════════════════
// SCRIPT 3: import_geocoding_results.js
// Purpose: Import geocoded results from Census into D1
// Usage: node scripts/import_geocoding_results.js <input.csv> <env.WY_DB>
// Usage (Cloudflare Worker): ./scripts/wr deploy (runs this via API)
// ════════════════════════════════════════════════════════════════════════════════

/*
const fs = require('fs');
const readline = require('readline');

const inputFile = process.argv[2] || '../data/voters_addr_norm_geocoded.csv';
const BATCH_SIZE = 100; // Update in batches of 100 to improve performance

async function importGeocoding(env) {
  console.log(`📥 Reading geocoding results from: ${inputFile}`);
  
  const rl = readline.createInterface({
    input: fs.createReadStream(inputFile),
    crlfDelay: Infinity
  });
  
  let rowCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let batch = [];
  
  for await (const line of rl) {
    // Skip header
    if (rowCount === 0) {
      rowCount++;
      continue;
    }
    
    try {
      const [voterId, lat, lng, status] = line.split(',');
      
      // Only process successful geocodes
      if (status.trim() !== 'OK' || !lat || !lng) {
        skipCount++;
        continue;
      }
      
      batch.push({
        voter_id: voterId.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      });
      
      rowCount++;
      
      // Execute batch update when limit reached
      if (batch.length >= BATCH_SIZE) {
        await executeBatch(env, batch);
        updateCount += batch.length;
        batch = [];
        
        if (rowCount % 1000 === 0) {
          console.log(`   Processed ${rowCount} rows, Updated ${updateCount}`);
        }
      }
    } catch (error) {
      console.error(`   Error parsing row ${rowCount}: ${error.message}`);
      errorCount++;
    }
  }
  
  // Process remaining batch
  if (batch.length > 0) {
    await executeBatch(env, batch);
    updateCount += batch.length;
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   Total rows processed: ${rowCount}`);
  console.log(`   Rows updated: ${updateCount}`);
  console.log(`   Rows skipped (not OK): ${skipCount}`);
  console.log(`   Errors: ${errorCount}`);
}

async function executeBatch(env, batch) {
  // Prepare batch SQL statements
  const statements = batch.map(row => ({
    sql: 'UPDATE voters_addr_norm SET lat = ?, lng = ? WHERE voter_id = ?',
    params: [row.lat, row.lng, row.voter_id]
  }));
  
  try {
    // Execute as transaction for consistency
    await env.WY_DB.batch(statements);
  } catch (error) {
    console.error(`❌ Batch update failed: ${error.message}`);
    throw error;
  }
}

// Export for Cloudflare Worker context
module.exports = { importGeocoding };
*/

// ════════════════════════════════════════════════════════════════════════════════
// SCRIPT 4: validate_geocoding.js
// Purpose: Validate geocoding results before import
// Usage: node scripts/validate_geocoding.js <input.csv>
// ════════════════════════════════════════════════════════════════════════════════

/*
const fs = require('fs');
const readline = require('readline');

const inputFile = process.argv[2] || '../data/voters_addr_norm_geocoded.csv';

async function validateGeocoding() {
  console.log(`🔍 Validating geocoding results: ${inputFile}`);
  
  const rl = readline.createInterface({
    input: fs.createReadStream(inputFile),
    crlfDelay: Infinity
  });
  
  const stats = {
    totalRows: 0,
    validOK: 0,
    noMatch: 0,
    multipleMatches: 0,
    invalidAddress: 0,
    errors: 0,
    otherStatus: 0,
    invalidFormat: 0
  };
  
  const latLngStats = {
    minLat: 90,
    maxLat: -90,
    minLng: 180,
    maxLng: -180
  };
  
  const validWyoming = {
    latMin: 40.998,
    latMax: 45.005,
    lngMin: -111.056,
    lngMax: -104.052
  };
  
  let headerSkipped = false;
  const issues = [];
  
  for await (const line of rl) {
    // Skip header
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }
    
    stats.totalRows++;
    
    try {
      const parts = line.split(',');
      if (parts.length < 4) {
        stats.invalidFormat++;
        issues.push(`Row ${stats.totalRows}: Invalid CSV format (${parts.length} cols)`);
        continue;
      }
      
      const voterId = parts[0].trim();
      const latStr = parts[1].trim();
      const lngStr = parts[2].trim();
      const status = parts[3].trim();
      
      // Track by status
      switch (status) {
        case 'OK':
          stats.validOK++;
          if (latStr && lngStr) {
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            
            // Check if coordinates are in Wyoming bounds
            if (lat < validWyoming.latMin || lat > validWyoming.latMax ||
                lng < validWyoming.lngMin || lng > validWyoming.lngMax) {
              issues.push(`Row ${stats.totalRows}: ${voterId} - Coordinates outside Wyoming (${lat}, ${lng})`);
            }
            
            latLngStats.minLat = Math.min(latLngStats.minLat, lat);
            latLngStats.maxLat = Math.max(latLngStats.maxLat, lat);
            latLngStats.minLng = Math.min(latLngStats.minLng, lng);
            latLngStats.maxLng = Math.max(latLngStats.maxLng, lng);
          } else {
            issues.push(`Row ${stats.totalRows}: ${voterId} - OK status but missing coordinates`);
          }
          break;
        case 'NO_MATCH':
          stats.noMatch++;
          break;
        case 'MULTIPLE_MATCHES':
          stats.multipleMatches++;
          break;
        case 'INVALID_ADDRESS':
          stats.invalidAddress++;
          break;
        case 'ERROR':
          stats.errors++;
          break;
        default:
          stats.otherStatus++;
          issues.push(`Row ${stats.totalRows}: Unknown status "${status}"`);
      }
    } catch (error) {
      stats.invalidFormat++;
      issues.push(`Row ${stats.totalRows}: Parse error - ${error.message}`);
    }
  }
  
  // Print report
  console.log(`\n📊 VALIDATION REPORT`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Total rows (excl header):  ${stats.totalRows}`);
  console.log(`\nStatus Distribution:`);
  console.log(`  OK:                      ${stats.validOK} (${(stats.validOK/stats.totalRows*100).toFixed(1)}%)`);
  console.log(`  NO_MATCH:                ${stats.noMatch} (${(stats.noMatch/stats.totalRows*100).toFixed(1)}%)`);
  console.log(`  MULTIPLE_MATCHES:        ${stats.multipleMatches} (${(stats.multipleMatches/stats.totalRows*100).toFixed(1)}%)`);
  console.log(`  INVALID_ADDRESS:         ${stats.invalidAddress} (${(stats.invalidAddress/stats.totalRows*100).toFixed(1)}%)`);
  console.log(`  ERROR:                   ${stats.errors} (${(stats.errors/stats.totalRows*100).toFixed(1)}%)`);
  console.log(`  OTHER:                   ${stats.otherStatus}`);
  console.log(`  INVALID FORMAT:          ${stats.invalidFormat}`);
  
  console.log(`\nCoordinate Bounds (from OK rows):`);
  console.log(`  Latitude:  ${latLngStats.minLat.toFixed(4)} to ${latLngStats.maxLat.toFixed(4)}`);
  console.log(`  Longitude: ${latLngStats.minLng.toFixed(4)} to ${latLngStats.maxLng.toFixed(4)}`);
  
  console.log(`\nExpected Wyoming Bounds:`);
  console.log(`  Latitude:  ${validWyoming.latMin} to ${validWyoming.latMax}`);
  console.log(`  Longitude: ${validWyoming.lngMin} to ${validWyoming.lngMax}`);
  
  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found: ${issues.length}`);
    issues.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
    if (issues.length > 10) {
      console.log(`   ... and ${issues.length - 10} more`);
    }
  } else {
    console.log(`\n✅ No validation issues found!`);
  }
}

validateGeocoding().catch(err => {
  console.error(`❌ Validation error: ${err.message}`);
  process.exit(1);
});
*/

// ════════════════════════════════════════════════════════════════════════════════
// SCRIPT 5: merge_geocoding_batches.js
// Purpose: Merge geocoded batch results from Census into single output CSV
// Usage: node scripts/merge_geocoding_batches.js <input_dir> <output.csv>
// ════════════════════════════════════════════════════════════════════════════════

/*
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const inputDir = process.argv[2] || '../data/geocoded_batches';
const outputFile = process.argv[3] || '../data/voters_addr_norm_geocoded.csv';

async function mergeBatches() {
  console.log(`📁 Merging batches from: ${inputDir}`);
  
  // Get all batch files
  const files = fs.readdirSync(inputDir)
    .filter(f => f.startsWith('batch_') && f.endsWith('.csv'))
    .sort();
  
  if (files.length === 0) {
    console.error(`❌ No batch files found in ${inputDir}`);
    process.exit(1);
  }
  
  console.log(`🔗 Found ${files.length} batch files`);
  
  const outputStream = fs.createWriteStream(outputFile);
  let headerWritten = false;
  let totalRows = 0;
  
  // Process each batch file
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    console.log(`  Processing: ${file}`);
    
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });
    
    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      
      // Skip header on all but first file
      if (lineNum === 1) {
        if (!headerWritten) {
          outputStream.write(line + '\n');
          headerWritten = true;
        }
        continue;
      }
      
      outputStream.write(line + '\n');
      totalRows++;
    }
  }
  
  outputStream.end();
  
  outputStream.on('finish', () => {
    console.log(`\n✅ Merge complete!`);
    console.log(`   Output file: ${outputFile}`);
    console.log(`   Total data rows: ${totalRows}`);
    console.log(`   File size: ${fs.statSync(outputFile).size} bytes`);
  });
}

mergeBatches().catch(err => {
  console.error(`❌ Merge error: ${err.message}`);
  process.exit(1);
});
*/

// ════════════════════════════════════════════════════════════════════════════════
// Usage Instructions
// ════════════════════════════════════════════════════════════════════════════════

/*
WORKFLOW USING THESE SCRIPTS:

1. Export from D1 (see GEOCODING_WORKFLOW.md COMMAND 3)
   ./scripts/wr d1 execute WY_DB --local ... --json > data/voters_addr_norm_to_geocode.json

2. Convert JSON to CSV
   node scripts/export_for_geocoding.js data/voters_addr_norm_to_geocode.json data/voters_addr_norm_to_geocode.csv

3. (Optional) Split into batches for easier Census submission
   node scripts/split_for_census.js data/voters_addr_norm_to_geocode.csv data/batches

4. Submit to Census Batch Geocoder (manually or via their API)
   - Upload CSV or batches
   - Download geocoded results
   - Save to data/geocoded_batches/ (if batched) or data/voters_addr_norm_geocoded.csv (if single file)

5. Merge batches if applicable
   node scripts/merge_geocoding_batches.js data/geocoded_batches data/voters_addr_norm_geocoded.csv

6. Validate results
   node scripts/validate_geocoding.js data/voters_addr_norm_geocoded.csv

7. Import into D1
   node scripts/import_geocoding_results.js data/voters_addr_norm_geocoded.csv
   (Requires env.WY_DB access via Cloudflare Worker context)

See GEOCODING_WORKFLOW.md for detailed command syntax and integration steps.
*/
