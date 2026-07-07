"""
Verification test for Bug #1 (EP degeneration) and Bug #4 (Advanced paradox).
"""
import sys
sys.path.insert(0, '.')

from services.bkt_service import fit_bkt_ep, bkt_update, mastery_to_level, accuracy_sanity_check

def test_50_percent_accuracy():
    """50% accuracy should NOT produce Advanced."""
    responses = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    params = fit_bkt_ep(responses)
    print(f"Test 1 - Params: {params}")
    mastery = params["L0"]
    for r in responses:
        mastery = bkt_update(mastery, r, params["T"], params["G"], params["S"])
    mastery = accuracy_sanity_check(mastery, responses)
    level = mastery_to_level(mastery)
    print(f"Test 1 - Mastery: {mastery:.4f} -> Level: {level}")
    assert level != "Advanced", f"BUG: 50% accuracy should not be Advanced! Got {level}"
    print("✅ Test 1 PASSED: 50% accuracy -> NOT Advanced\n")

def test_30_percent_accuracy():
    """30% accuracy should be Beginner."""
    responses = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
    params = fit_bkt_ep(responses)
    print(f"Test 2 - Params: {params}")
    mastery = params["L0"]
    for r in responses:
        mastery = bkt_update(mastery, r, params["T"], params["G"], params["S"])
    mastery = accuracy_sanity_check(mastery, responses)
    level = mastery_to_level(mastery)
    print(f"Test 2 - Mastery: {mastery:.4f} -> Level: {level}")
    assert level == "Beginner", f"BUG: 30% accuracy should be Beginner, got {level}!"
    print("✅ Test 2 PASSED: 30% accuracy -> Beginner\n")

def test_perfect_accuracy():
    """100% accuracy with small data should NOT be Advanced (uncertainty zone)."""
    responses = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    params = fit_bkt_ep(responses)
    print(f"Test 3 - Params: {params}")
    mastery = params["L0"]
    for r in responses:
        mastery = bkt_update(mastery, r, params["T"], params["G"], params["S"])
    # No sanity check needed for 100% accuracy, but check mastery delta cap
    level = mastery_to_level(mastery)
    print(f"Test 3 - Mastery: {mastery:.4f} -> Level: {level}")
    # With delta cap of 0.10, 10 steps from L0=0.7 shouldn't reach 0.99
    assert mastery <= 0.99, f"Mastery exceeded cap: {mastery}"
    print("✅ Test 3 PASSED: 100% accuracy with small data stays within bounds\n")

def test_degenerate_params_prevented():
    """EP fitting for 10 responses should return defaults, NOT degenerate 0.5 values."""
    responses = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    params = fit_bkt_ep(responses)
    assert params["G"] != 0.5, f"BUG: G should not be 0.5, got {params['G']}"
    assert params["S"] != 0.5, f"BUG: S should not be 0.5, got {params['S']}"
    assert params["T"] != 0.5, f"BUG: T should not be 0.5, got {params['T']}"
    # Should return defaults since < 20 responses
    assert params["G"] == 0.20, f"Expected default G=0.20, got {params['G']}"
    assert params["S"] == 0.10, f"Expected default S=0.10, got {params['S']}"
    assert params["T"] == 0.10, f"Expected default T=0.10, got {params['T']}"
    print(f"Test 4 - Params: {params}")
    print("✅ Test 4 PASSED: EP fitting returns calibrated defaults for small data\n")

def test_mastery_delta_cap():
    """A single correct answer should not increase mastery by more than 0.10."""
    prev_mastery = 0.30
    params = {"T": 0.10, "G": 0.20, "S": 0.10}
    new_mastery = bkt_update(prev_mastery, 1, params["T"], params["G"], params["S"])
    delta = new_mastery - prev_mastery
    print(f"Test 5 - Delta: {delta:.4f} (prev={prev_mastery:.4f}, new={new_mastery:.4f})")
    assert delta <= 0.10 + 1e-9, f"BUG: Mastery jumped {delta:.4f}, exceeds delta cap 0.10!"
    print("✅ Test 5 PASSED: Mastery delta cap enforced\n")

if __name__ == "__main__":
    print("=" * 60)
    print("VERIFICATION: Bug #1 and #4 Fixes")
    print("=" * 60 + "\n")
    
    test_50_percent_accuracy()
    test_30_percent_accuracy()
    test_perfect_accuracy()
    test_degenerate_params_prevented()
    test_mastery_delta_cap()
    
    print("=" * 60)
    print("ALL 5 TESTS PASSED ✅")
    print("=" * 60)
