#!/usr/bin/env python3
"""
Sync Wyoming legislators from remote WY_DB to local WY_DB
Exports all 93 legislators from remote and inserts into local database
"""

import json
import subprocess
import sys

def export_from_remote():
    """Export legislator data from remote database"""
    cmd = [
        'wrangler', 'd1', 'execute', 'WY_DB', '--remote',
        '--command',
        '''SELECT json_object(
            'voter_id', voter_id,
            'name', name,
            'chamber', chamber,
            'district', district,
            'city', city,
            'county', county,
            'party', party,
            'affiliations', affiliations,
            'campaign_website', campaign_website,
            'official_profile_url', official_profile_url,
            'phone', phone,
            'email', email,
            'updated', updated
        ) FROM wy_legislators;'''
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd='/home/anchor/projects/this-is-us/worker')
        if result.returncode != 0:
            print(f"Error exporting from remote: {result.stderr}")
            return []
        
        # Parse the output - it's in JSON format
        output = result.stdout
        # Extract JSON data from wrangler output
        import re
        json_matches = re.findall(r'\{[^{}]*"voter_id"[^{}]*\}', output)
        
        legislators = []
        for match in json_matches:
            try:
                leg = json.loads(match)
                legislators.append(leg)
            except json.JSONDecodeError:
                continue
        
        return legislators
    except Exception as e:
        print(f"Exception: {e}")
        return []

def insert_to_local(legislators):
    """Insert legislator data into local database"""
    if not legislators:
        print("No legislator data to insert")
        return False
    
    print(f"Inserting {len(legislators)} legislators into local database...")
    
    for i, leg in enumerate(legislators):
        # Build insert statement
        voter_id = leg.get('voter_id')
        name = leg.get('name', '').replace('"', '""')
        chamber = leg.get('chamber', '')
        district = leg.get('district')
        city = leg.get('city', '').replace('"', '""')
        county = leg.get('county', '').replace('"', '""')
        party = leg.get('party', '').replace('"', '""')
        affiliations = leg.get('affiliations', '').replace('"', '""')
        campaign_website = leg.get('campaign_website', '').replace('"', '""')
        official_profile_url = leg.get('official_profile_url', '').replace('"', '""')
        phone = leg.get('phone', '').replace('"', '""')
        email = leg.get('email', '').replace('"', '""')
        updated = leg.get('updated', '').replace('"', '""')
        
        # Handle NULL district
        district_val = 'NULL' if district is None else str(district)
        
        insert_sql = f'''INSERT INTO wy_legislators VALUES({voter_id},"{name}","{chamber}",{district_val},"{city}","{county}","{party}","{affiliations}","{campaign_website}","{official_profile_url}","{phone}","{email}","{updated}");'''
        
        cmd = ['wrangler', 'd1', 'execute', 'WY_DB', '--local', '--command', insert_sql]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, cwd='/home/anchor/projects/this-is-us/worker')
            if result.returncode != 0:
                print(f"Error inserting legislator {i+1}: {result.stderr}")
            elif (i + 1) % 10 == 0:
                print(f"  ✓ Inserted {i + 1}/{len(legislators)}")
        except Exception as e:
            print(f"Exception inserting legislator {i+1}: {e}")
    
    print(f"✓ Completed inserting {len(legislators)} legislators")
    return True

if __name__ == '__main__':
    print("Starting legislator data sync...")
    legislators = export_from_remote()
    print(f"Exported {len(legislators)} legislators from remote")
    
    if insert_to_local(legislators):
        print("\n✅ Sync complete!")
    else:
        print("\n❌ Sync failed")
        sys.exit(1)
