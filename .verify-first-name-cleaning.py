#!/usr/bin/env python3
"""
Verification script for first-name-cleaning LOCKED_PROMPT constant.
User requirement: constant must be EXACTLY 9002 chars (§6 fence[0] only),
end with "Name to clean:", and NOT contain the input template junk.
"""
import sys

def verify():
    with open('deepline/plays/signals/first-name-cleaning.play.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the constant
    start_marker = 'const LOCKED_PROMPT_FIRST_NAME_CLEANING = `'
    start_idx = content.find(start_marker)
    
    if start_idx == -1:
        print("✗ Could not find LOCKED_PROMPT_FIRST_NAME_CLEANING")
        return False
    
    content_start = start_idx + len(start_marker)
    
    # Find closing `;
    search_start = content_start
    end_idx = -1
    
    while True:
        candidate = content.find('`;', search_start)
        if candidate == -1:
            break
        if content[candidate - 1] != '\\':
            end_idx = candidate
            break
        search_start = candidate + 1
    
    if end_idx == -1:
        print("✗ Could not find constant end")
        return False
    
    # Extract constant
    unescaped_const = content[content_start:end_idx]
    
    # Print info
    print(f"LOCKED_PROMPT_FIRST_NAME_CLEANING verification:")
    print(f"  Length: {len(unescaped_const)} chars")
    print(f"  Ends with 'Name to clean:': {unescaped_const.endswith('Name to clean:')}")
    print(f"  Has junk template: {'first=\"<raw first name>\"' in unescaped_const}")
    
    # Assertions
    try:
        assert len(unescaped_const) == 9002, f"Expected 9002 chars, got {len(unescaped_const)}"
        assert unescaped_const.endswith('Name to clean:'), "Must end with 'Name to clean:'"
        assert 'first="<raw first name>"' not in unescaped_const, "Input template junk found in constant"
        print("\n✅ VERIFIED: Constant matches user requirements")
        return True
    except AssertionError as e:
        print(f"\n✗ VERIFICATION FAILED: {e}")
        return False

if __name__ == '__main__':
    sys.exit(0 if verify() else 1)
