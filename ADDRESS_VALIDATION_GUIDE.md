# Address Validation & Normalization Guide

## Overview

The Wyoming voter address normalization pipeline includes validation tools to ensure addresses meet standardized formatting requirements before being sent to the Census Geocoder API.

## Files

- **`scripts/address_validator.py`** - Core validation module
- **`scripts/geocode_voters_addr_norm.py`** - Geocoding script with `--check` mode

## Normalization Rules

### addr1 (Street Address)
**Format**: Single-line USPS-style street address  
**Example**: `"1000 E UNIVERSITY AVE"` or `"742 W OAK ST S"`

**Rules**:
- ✓ All uppercase letters
- ✓ Single spaces between tokens
- ✓ Starts with house number (0-5 digits)
- ✓ Standard USPS abbreviations: ST, AVE, RD, BLVD, APT, STE, UNIT, etc.
- ✓ Directionals normalized: N, S, E, W, NE, NW, SE, SW
- ✗ NO commas or periods
- ✗ NO fractional house numbers (1/2, 1\2, etc.) ⚠️ **CRITICAL**
- ✗ NO multiple consecutive spaces
- ✗ NO building names without house numbers

**Valid Examples**:
```
1000 E UNIVERSITY AVE
123 MAIN ST
742 W OAK ST S
111 DOWNEY HALL APT A
1 FORK RD
```

**Invalid Examples**:
```
1/2 STEELE ST              ← Fractional house number (FAILS)
1\2 S 6TH ST               ← Backslash in house number (FAILS)
WHITE HALL                 ← No house number (FAILS)
123 Main Street            ← Not all uppercase (FAILS)
123,  Main St.             ← Comma and period (FAILS)
```

### city (City Name)
**Format**: Uppercase city name only  
**Example**: `"LARAMIE"`

**Rules**:
- ✓ All uppercase
- ✓ No "CITY OF" prefix
- ✓ No extra descriptive words
- ✗ NO commas or periods
- ✗ NO multiple spaces

**Valid Examples**:
```
LARAMIE
CHEYENNE
ROCK SPRINGS
```

**Invalid Examples**:
```
CITY OF LARAMIE    ← Extra words (FAILS)
Laramie            ← Not uppercase (FAILS)
LARAMIE, WY        ← Contains comma (FAILS)
```

### state (State Code)
**Format**: Two-letter state abbreviation  
**Example**: `"WY"`

**Rules**:
- ✓ Exactly 2 letters
- ✓ Letters only
- ✓ Uppercase
- ✗ NO periods or abbreviations like "Wyo."

### zip (ZIP Code)
**Format**: 5-digit numeric ZIP code or empty  
**Example**: `"82070"`

**Rules**:
- ✓ Exactly 5 digits (0-9)
- ✓ Can be empty string if unknown
- ✗ NO formatting like "82070-1234" (ZIP+4)
- ✗ NO letters or special characters

**Valid Examples**:
```
82070
80203
(empty string)
```

## Running Validation

### Check Mode (Validation Only)

Check mode validates addresses WITHOUT running geocoding:

```bash
# Use default input file
python3 scripts/geocode_voters_addr_norm.py --check

# Specify custom input file
python3 scripts/geocode_voters_addr_norm.py --check \
  --input data/voters_addr_norm_to_geocode.csv
```

**Output**:
- Summary statistics (total, valid, invalid, validation rate)
- First 20 invalid records with detailed issues
- Issue breakdown by type with counts and percentages
- Exit code: 0 if all valid, 1 if any invalid

### Standalone Validator

Run the validator directly:

```bash
python3 scripts/address_validator.py data/voters_addr_norm_to_geocode.csv
```

## Current Validation Results

**Data**: `data/voters_addr_norm_to_geocode.csv` (6,211 records)

```
Total records:      6,211
Valid records:      5,539 (89.2%)
Invalid records:      672 (10.8%)
```

### Issues Found

| Issue Type | Count | Percent | Description |
|---|---|---|---|
| **fractional_house_number** | 530 | 8.5% | Addresses like "1/2 STEELE ST" |
| **addr_has_special_chars** | 643 | 10.4% | Contains "/" or "\" characters |
| **empty_street** | 29 | 0.5% | No street address provided |

### Top Invalid Addresses

```
1/2 STEELE ST         (multiple records)
1/2 STEELE ST         (multiple records)
1/2 S 9TH ST          (multiple records)
1/2 S 8TH ST          (multiple records)
1/2 S 7TH ST          (multiple records)
1/2 S 6TH ST          (multiple records)
1/2 S 5TH ST          (multiple records)
1/2 S 4TH ST          (multiple records)
1\2 S 6TH ST          (backslash variant)
111C DOWNEY HALL      (building with letter)
```

## Why Fractional House Numbers Matter

Fractional house numbers (1/2, 1\2, etc.) represent **half-units or shared addresses** in Wyoming:
- Common in residential areas with duplexes or apartments
- Real addresses in the voter database
- **Problem**: U.S. Census database only recognizes whole-number house numbers

**Impact on Geocoding**:
- Census API: 0% match rate (returns NO_MATCH)
- Solution: Must use fallback geocoding (city/state centroid)

**Example**:
```
Input:    1/2 STEELE ST, LARAMIE, WY, 82070
Census:   NO_MATCH (doesn't understand fraction)
Fallback: Assign LARAMIE city centroid (±5-10 miles)
```

## Address Validation Classes

### AddressValidator

Main validation class with static methods:

```python
from address_validator import AddressValidator

result = AddressValidator.validate_address(
    voter_id="200290773",
    addr1="1/2 STEELE ST",
    city="LARAMIE",
    state="WY",
    zip_code="82070"
)

if result.is_valid:
    print("✓ Address is valid")
else:
    for issue_type, description in result.issues:
        print(f"✗ {issue_type.value}: {description}")
```

### ValidationResult

Result dataclass:

```python
@dataclass
class ValidationResult:
    voter_id: str                                    # Voter ID
    is_valid: bool                                   # True if no issues
    issues: List[Tuple[ValidationIssue, str]]       # List of problems
```

### ValidationIssue Enum

Issue types:
- `FRACTIONAL_HOUSE_NUMBER` - "1/2 STEELE ST"
- `NO_HOUSE_NUMBER` - "MAIN ST" (missing number)
- `MULTIPLE_SPACES` - "123  MAIN" (extra space)
- `CONTAINS_COMMA` - "123 Main, St."
- `CONTAINS_PERIOD` - "123 St."
- `NOT_UPPERCASE` - "123 Main St"
- `INVALID_DIRECTIONAL` - "123 NORTH" (should be "N")
- `INVALID_SUFFIX` - "123 ROAD" (should be "RD")
- `EMPTY_STREET` - Empty or too short
- `INVALID_CITY` - Empty or invalid format
- `INVALID_STATE` - Not 2 letters
- `INVALID_ZIP` - Not 5 digits
- `CITY_HAS_EXTRA_WORDS` - "CITY OF LARAMIE"
- `ADDR_HAS_SPECIAL_CHARS` - Invalid characters

## Integration with Geocoding

### Workflow

```
Raw CSV
  ↓
prepare_voters_for_geocoding.py (extract & normalize)
  ↓
voters_addr_norm_to_geocode.csv
  ↓
geocode_voters_addr_norm.py --check (validate)
  ↓
  ├─ 89.2% VALID → Send to Census API
  └─ 10.8% INVALID
     ├─ 530 fractional → Mark for fallback
     ├─ 29 empty → Skip or fallback
     └─ 113 other → Skip
```

### Census Geocoding Limitations

The Census Batch Geocoder has known limitations:

| Address Type | Census Match | Fallback |
|---|---|---|
| Standard addresses | ✓ High (95%+) | Not needed |
| Fractional numbers | ✗ Zero (0%) | ✓ City centroid |
| Building names only | ✗ Low (<5%) | ✓ City centroid |
| Incomplete streets | ✗ Low (<10%) | ✓ City centroid |
| Missing ZIP codes | ✗ Medium (20-50%) | ✓ City centroid |

## Recommended Process

### 1. Extract & Normalize
```bash
python3 scripts/prepare_voters_for_geocoding.py
# Outputs: data/voters_addr_norm_to_geocode.csv
```

### 2. Validate Normalization
```bash
python3 scripts/geocode_voters_addr_norm.py --check
# Review results and fix any obvious issues
```

### 3. Geocode Valid Records
```bash
python3 scripts/geocode_voters_addr_norm.py
# Sends valid records to Census API
```

### 4. Apply Fallback
```bash
python3 scripts/geocode_with_fallback.py
# Assigns city/state centroids to failures
```

### 5. Consolidate Results
Merge Census matches with fallback coordinates into final dataset.

## Development Notes

### Adding New Validation Rules

To add a new validation rule in `address_validator.py`:

1. Add `ValidationIssue` enum value:
```python
class ValidationIssue(Enum):
    MY_NEW_ISSUE = "my_new_issue"
```

2. Add validation method:
```python
@staticmethod
def _validate_something(field: str) -> List[Tuple[ValidationIssue, str]]:
    issues = []
    if problem_found:
        issues.append((
            ValidationIssue.MY_NEW_ISSUE,
            f"Description: {field}"
        ))
    return issues
```

3. Call in main `validate_address` method:
```python
issues.extend(AddressValidator._validate_something(addr1))
```

### Testing

```bash
# Test address validator directly
python3 scripts/address_validator.py data/voters_addr_norm_to_geocode.csv

# Test geocoding script check mode
python3 scripts/geocode_voters_addr_norm.py --check
```

## Troubleshooting

### Check mode shows 100% valid but Census has low match rate

This is expected. Validation checks format compliance, not whether the Census database has the address. Many correctly-formatted addresses still won't match Census due to:
- Database currency (addresses added/removed)
- Regional variations
- Fractional house numbers
- Rural/farm addresses

### Fractional addresses keep appearing

These come from the source voter registration data and are real addresses. Options:
1. Filter them out (current approach)
2. Strip the fraction (loses information)
3. Use alternative geocoding service that supports fractions
4. Contact voter registration office for mailing addresses

### ZIP code validation is too strict

Currently requires exactly 5 digits. If you need to:
- Allow empty ZIP: ✓ Already supported
- Allow ZIP+4: Add new rule to validator
- Allow partial ZIP: Add new rule to validator

## References

- [USPS Address Standards](https://pe.usps.com/text/pub28/28apc.htm)
- [U.S. Census Geocoder](https://geocoding.geo.census.gov/geocoder/)
- [Wyoming City/County Information](https://en.wikipedia.org/wiki/List_of_cities_and_towns_in_Wyoming)

## Contact & Support

For questions about address validation, check the comments in:
- `scripts/address_validator.py` - Validation logic
- `scripts/geocode_voters_addr_norm.py` - Integration & check mode
