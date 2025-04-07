import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded translations (For testing purposes)
hardcoded_translations = {
    "water": "vand",
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
    
    # Just for testing: Replace the nouns in the incoming text with hardcoded translations
    words = content.split()
    translated_words = []

    for word in words:
        # Check if word exists in the translations, if yes, replace it
        translated_word = hardcoded_translations.get(word.lower(), word)
        translated_words.append(translated_word)

    translated_text = " ".join(translated_words)

    print("\n=== Translated Text ===\n")
    print(translated_text[:1000])  # Print first 1000 chars of translated text
    print("\n=====================\n")

    return jsonify({"translated_text": translated_text})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
