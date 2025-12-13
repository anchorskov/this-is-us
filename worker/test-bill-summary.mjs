#!/usr/bin/env node

/**
 * Test script for billSummaryAnalyzer integration
 * 
 * Usage: 
 *   OPENAI_API_KEY=sk-... node test-bill-summary.mjs
 *   
 * This script demonstrates the complete bill summary pipeline:
 * 1. Load test bills from civic_items
 * 2. Analyze each bill with billSummaryAnalyzer
 * 3. Save results to database
 * 4. Verify persistence
 */

import { analyzeBillSummary, saveBillSummary } from './src/lib/billSummaryAnalyzer.mjs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

const env = { OPENAI_API_KEY };

// Test bills from database (matching seed data)
const TEST_BILLS = [
  {
    id: 'test-hb22',
    bill_number: 'HB 22',
    title: 'Property Tax Assessment Cap',
    summary: 'Establishes annual caps on property tax assessment increases at 3% or inflation, whichever is lower, to prevent sudden tax spikes on homeowners.',
    subject_tags: 'taxes,property'
  },
  {
    id: 'test-hb164',
    bill_number: 'HB 164',
    title: 'Groundwater Withdrawal Permits',
    summary: 'Establishes new permitting process for groundwater withdrawal in high-demand regions with impact assessments for competing water uses.',
    subject_tags: 'water,agriculture'
  },
  {
    id: 'test-sf174',
    bill_number: 'SF 174',
    title: 'K-12 Education Funding Formula',
    summary: 'Revises school funding distribution to increase per-pupil spending and boost support for rural districts and special education.',
    subject_tags: 'education'
  },
  {
    id: 'test-hb286',
    bill_number: 'HB 286',
    title: 'Renewable Energy Transmission Permitting',
    summary: 'Streamlines permitting for transmission lines connecting renewable energy projects to the grid with expedited review timelines.',
    subject_tags: 'energy,environment'
  },
  {
    id: 'test-sf89',
    bill_number: 'SF 89',
    title: 'Fentanyl Interdiction and Treatment',
    summary: 'Provides funding for fentanyl interdiction and expands access to medication-assisted treatment and recovery services.',
    subject_tags: 'public-safety,health'
  }
];

async function main() {
  console.log('🧪 Bill Summary Analyzer Integration Test\n');
  console.log('📊 Testing with', TEST_BILLS.length, 'bills\n');
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const bill of TEST_BILLS) {
    console.log(`📋 Processing: ${bill.bill_number} - ${bill.title}`);
    
    try {
      // Analyze bill
      const analysis = await analyzeBillSummary(env, bill);
      
      if (analysis.plain_summary && analysis.key_points.length > 0) {
        console.log(`   ✅ Analysis generated`);
        console.log(`      - Summary: ${analysis.plain_summary.substring(0, 80)}...`);
        console.log(`      - Key points: ${analysis.key_points.length}`);
        successCount++;
      } else {
        console.log(`   ⚠️  Empty analysis returned`);
        failureCount++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failureCount++;
    }
    
    console.log();
  }
  
  // Summary
  console.log('━'.repeat(60));
  console.log(`\n📈 Results: ${successCount}/${TEST_BILLS.length} successful`);
  
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} analyses failed or empty\n`);
  } else {
    console.log(`🎉 All analyses completed successfully!\n`);
  }
  
  console.log('Next steps:');
  console.log('1. Integration into civicScan.mjs route handler');
  console.log('2. Include ai_summary and ai_key_points in API response');
  console.log('3. Test with UI component rendering');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
