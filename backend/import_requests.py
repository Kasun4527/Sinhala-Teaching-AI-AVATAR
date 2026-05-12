import requests
import json

URL = " https://cupbearer-pointing-serotonin.ngrok-free.dev/ask" # ← update each time tunnel restarts

# Same 4 test cases as test_sinllama.py on HPC
test_cases = [
    {
        "id": "Test 3 - Health / Buddhism (7 questions)",
        "instruction": "ඉහත පෙළ ඇසුරින් අර්ථවත් ප්‍රශ්න හතක් සාදා, නිවැරදි පිළිතුර සහ වැරදි පිළිතුරු තුනක් බැගින් සපයන්න.",
        "input": "නීරෝගීකම පරම ලාභය බව බුදුරදුන් වදාළහ. රහතන් වහන්සේලා හැර අනෙක් සියලු දෙනා මානසික ලෙඩුන් බව උන්වහන්සේගේ මතයයි. විශේෂයෙන්ම කාමමිථ්‍යාචාරයෙන් සහ මත්ද්‍රව්‍ය භාවිතයෙන් වැළකීම මාරාන්තික රෝගවලින් ආරක්ෂා වීමට මග පාදයි. බුදුදහමේ එන පංච ශීල ප්‍රතිපදාව කායික හා මානසික නීරෝගීභාවයට සෘජුවම බලපායි. දානාදී පින්කම් සහ සිල්වත්කම ආයුෂ, වර්ණ, සැප, බල වැඩීමට හේතු වන අතර භාවනාව මගින් මානසික පවිත්‍රතාවය ඇති වේ.",
    }
]

for test in test_cases:
    print("=" * 60)
    print(f"🔹 {test['id']}")
    print("=" * 60)

    payload = {
        "instruction": test["instruction"],
        "input": test["input"],
        "max_new_tokens": 1024,
    }

    try:
        response = requests.post(
            URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=120,
        )
        print(response.json()["answer"])
    except Exception as e:
        print(f"❌ Error: {e}")

    print()