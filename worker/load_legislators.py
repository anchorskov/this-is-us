#!/usr/bin/env python3
"""
Load Wyoming legislature CSV into local wy_legislators table
"""

import csv
import subprocess
import sys

csv_file = '/home/anchor/projects/this-is-us/worker/wy_legislature_12-1-25.csv.csv'

def load_csv_and_insert():
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                # Map CSV columns to table columns
                voter_id = row.get('voter_id')
                name = row.get('Name', '').replace('"', '""')
                chamber = row.get('Chamber', '')
                district = row.get('District') if row.get('District') else 'NULL'
                city = row.get('City', '').replace('"', '""')
                county = row.get('County', '').replace('"', '""')
                party = row.get('Party', '').replace('"', '""')
                affiliations = row.get('Affiliations', '').replace('"', '""')
                campaign_website = row.get('Cam paign_Website', '').replace('"', '""') or row.get('Campaign_Website', '').replace('"', '""')
                official_profile_url = row.get('Official_Profile_URL', '').replace('"', '""')
                phone = row.get('Phone', '').replace('"', '""')
                email = row.get('Email', '').replace('"', '""')
                updated = row.get('updated', '').replace('"', '""')
                
                # Build INSERT statement
                insert_sql = f'''INSERT INTO wy_legislators (voter_id, name, chamber, district, city, county, party, affiliations, campaign_website, official_profile_url, phone, email, updated) 
VALUES ({voter_id}, "{name}", "{chamber}", {district}, "{city}", "{county}", "{party}", "{affiliations}", "{campaign_website}", "{official_profile_url}", "{phone}", "{email}", "{updated}");'''
                
                # Execute insert
                cmd = ['./scripts/wr', 'd1', 'execute', 'WY_DB', '--local', '--command', insert_sql]
                result = subprocess.run(cmd, capture_output=True, text=True, cwd='/home/anchor/projects/this-is-us/worker')
                
                if result.returncode != 0:
                    print(f"Error inserting row: {result.stderr}")
                    continue
                
                count += 1
                if count % 20 == 0:
                    print(f"✓ Inserted {count} legislators...")
        
        print(f"✅ Successfully loaded {count} legislators from CSV")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("Loading Wyoming legislature CSV into local database...")
    load_csv_and_insert()
