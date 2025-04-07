import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded translations (For testing purposes)
hardcoded_translations = {
    "cat": "kat",
    "coffee": "kaffe",
    "river": "flod",
    "sun": "sol",
    "moon": "måne",
    "dog": "hund",
    "car": "bil",
    "house": "hus",
    "tree": "træ",
    "book": "bog",
    "computer": "computer",
    "city": "by",
    "school": "skole",
    "friend": "ven",
    "music": "musik",
    "love": "kærlighed",
    "apple": "æble",
    "food": "mad",
    "phone": "telefon",
    "bike": "cykel",
}

@app.route("/replace-nouns", methods=["POST"])
def replace_nouns():
    content = request.json.get("text", "")
    print("\n=== Incoming Text ===\n")
    print(content[:1000])  # Print first 1000 chars for debugging
    print("\n=====================\n")
    
    # Split the text into words and check for translations
    words = content.split()
    replacements = {}

    for word in words:
        translated_word = hardcoded_translations.get(word.lower(), None)
        if translated_word:
            replacements[word] = translated_word

    print("\n=== Replacements ===\n")
    print(replacements)
    print("\n=====================\n")

    return jsonify(replacements)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
