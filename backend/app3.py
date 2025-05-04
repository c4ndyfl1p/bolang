from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import spacy
from collections import Counter

app = Flask(__name__)
CORS(app)



# Load English model from spaCy (make sure you installed it: python3 -m spacy download en_core_web_sm)
nlp = spacy.load("en_core_web_sm")

DEEPL_API_KEY = "96e95726-e27b-4bb0-b70d-4a0640e4c219:fx"

def batch_translate_words(words, source_lang="EN", target_lang="DA"):
    url = "https://api-free.deepl.com/v2/translate"
    params = {
        "auth_key": DEEPL_API_KEY,
        "text": words,  # pass a list
        "source_lang": source_lang,
        "target_lang": target_lang
    }
    
    try:
        response = requests.post(url, data=params, timeout=10)
        response.raise_for_status()
        result = response.json()
        translations = result['translations']
        return [entry['text'] for entry in translations]
    except Exception as e:
        print(f"Batch DeepL error: {e}")
        return [word + " (DK)" for word in words]



@app.route("/get-replacements", methods=["GET"])
def get_replacements():
    # Get URL sent by extension
    url = request.args.get('url')

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        # Fetch the page
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Get all visible text
        texts = soup.stripped_strings
        
        full_text = " ".join(texts)

        # Process with spaCy
        doc = nlp(full_text)

        # Extract all nouns
        nouns_list = [token.text.lower() for token in doc if token.pos_ == "NOUN" and token.is_alpha]
        
        # Pick the most common nouns
        noun_counts = Counter(nouns_list)
        top_nouns = [noun for noun, count in noun_counts.most_common(30)]

        # Fake translation: just add " (DK)" for now
        # translated_nouns = {noun: noun + " (DK)" for noun in top_nouns}

        # using DEEPL API to translate the nouns
        translated_texts = batch_translate_words(top_nouns)
        translated_nouns = dict(zip(top_nouns, translated_texts))


        # For verbs, we can just return an empty dictionary for now
        translated_verbs = {}

        print(f"Generated {len(translated_nouns)} translated nouns from {url}")

        return jsonify({
            "nouns": translated_nouns,
            "verbs": translated_verbs
        })

    except Exception as e:
        print(f"Error processing URL {url}: {e}")
        return jsonify({"error": "Failed to process the URL"}), 500


if __name__ == "__main__":
    app.run(debug=True)
