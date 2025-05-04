from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import spacy
from collections import Counter
import os
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

# Load English model from spaCy
nlp = spacy.load("en_core_web_sm")

load_dotenv()  # load variables from .env

DEEPL_API_KEY = os.getenv("DEEPL_API_KEY")
if DEEPL_API_KEY is None:
    raise ValueError("DEEPL_API_KEY not found in environment")


# Simple in-memory cache (key: word, value: translation)
translation_cache = {}


def batch_translate_words(words, source_lang, target_lang):
    url = "https://api-free.deepl.com/v2/translate"
    params = {
        "auth_key": DEEPL_API_KEY,
        "source_lang": source_lang,
        "target_lang": target_lang,
    }
    
    data = params.copy()
    for word in words:
        data.setdefault('text', []).append(word)

    try:
        response = requests.post(url, data=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        translations = result['translations']
        return [entry['text'] for entry in translations]
    except Exception as e:
        print(f"Batch DeepL error: {e}")
        return [word + " (DK)" for word in words]  # fallback dummy translation

@app.route("/get-replacements", methods=["GET"])
def get_replacements():
    url = request.args.get('url')
    print(f"Received URL: {url}")
    print(f"targetlanguage: {request.args.get('targetLanguage')}")
    source_lang = "EN"
    target_lang = request.args.get('targetLanguage')
    nounSliderValue = int(request.args.get('nounSliderValue', 1))  # default to 1 if not provided
    verbSliderValue = int(request.args.get('verbSliderValue', 1))  # default to 1 if not provided
    prepositionSliderValue = int(request.args.get('prepositionSliderValue', 1))

    # Map slider values to intensities
    noun_intensity_map = {
        0: 0,
        1: 5,
        2: 30
    }
    noun_intensity = noun_intensity_map.get(nounSliderValue, 5)


    # Map slider values to intensities
    verb_intensity_map = {
        0: 0,
        1: 5,
        2: 30
    }
    verb_intensity = verb_intensity_map.get(verbSliderValue, 5)
    
    # Map slider values to intensities
    preposition_intensity_map = {
        0: 0,
        1: 5,
        2: 30
    }
    preposition_intensity = preposition_intensity_map.get(prepositionSliderValue, 5)



    # target_lang = "DA"
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    # return jsonify({
    #         "nouns": {"water"   : "vand"},
    #         "verbs": {"run"     : "løbe"},
    #         "prepositions": {"in"     : "i"},
    #     })

    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, 'html.parser')

        texts = soup.stripped_strings
        full_text = " ".join(texts)

        doc = nlp(full_text)

        nouns_list = [token.text.lower() for token in doc if token.pos_ == "NOUN" and token.is_alpha]
        verbs_list = [token.text.lower() for token in doc if token.pos_ == "VERB" and token.is_alpha]
        prepositions_list = [token.text.lower() for token in doc if token.pos_ == "ADP" and token.is_alpha]
        pronouns_list = [token.text.lower() for token in doc if token.pos_ == "PRON" and token.is_alpha]
        adjectives_list = [token.text.lower() for token in doc if token.pos_ == "ADJ" and token.is_alpha]
        adverbs_list = [token.text.lower() for token in doc if token.pos_ == "ADV" and token.is_alpha]


        top_nouns = [noun for noun, count in Counter(nouns_list).most_common(noun_intensity)]
        top_verbs = [verb for verb, count in Counter(verbs_list).most_common(preposition_intensity)]
        top_prepositions = [prep for prep, count in Counter(prepositions_list).most_common(verb_intensity)]
        top_pronouns = [pronoun for pronoun, count in Counter(pronouns_list).most_common(0)]
        top_adjectives = [adj for adj, count in Counter(adjectives_list).most_common(0)]
        top_adverbs = [adv for adv, count in Counter(adverbs_list).most_common(0)]

        # Combine all words to translate
        all_words = list(set(top_nouns + top_verbs + top_prepositions + top_pronouns + top_adjectives + top_adverbs))

        translations = batch_translate_words(all_words, source_lang, target_lang)

        # Get translations (cached + newly translated)
        translation_dict = {word: translated for word, translated in zip(all_words, translations)}
        # translation_dict = get_cached_or_translated(all_words, source_lang, target_lang)
        
        # tip: if intnsity is 0: you can send empty dict. but you cant send no dict
        translated_nouns = {noun: translation_dict[noun] for noun in top_nouns if noun in translation_dict}
        translated_verbs = {verb: translation_dict[verb] for verb in top_verbs if verb in translation_dict}
        translated_prepositions = {prep: translation_dict[prep] for prep in top_prepositions if prep in translation_dict}
        translated_pronouns = {pronoun: translation_dict[pronoun] for pronoun in top_pronouns if pronoun in translation_dict}
        translated_adjectives = {adj: translation_dict[adj] for adj in top_adjectives if adj in translation_dict}
        translated_adverbs = {adv: translation_dict[adv] for adv in top_adverbs if adv in translation_dict}


        print(f"Generated {len(translated_nouns)} nouns, {len(translated_verbs)} verbs, {len(translated_prepositions)}, prepositions from {url}")
        
        print(translated_prepositions, translated_verbs, translated_nouns)

        print(f"Generated {len(translated_pronouns)} pronouns, {len(translated_adjectives)} adjectives, {len(translated_adverbs)} adverbs from {url}")
        print(translated_pronouns, translated_adjectives, translated_adverbs)
        return jsonify({
            "nouns": translated_nouns,
            "verbs": translated_verbs,
            "prepositions": translated_prepositions,
            "pronouns" : translated_pronouns,
            # "adjectives" : translated_adjectives,
            # "adverbs" : translated_adverbs,
        })

    except Exception as e:
        print(f"Error processing URL {url}: {e}")
        return jsonify({"error": "Failed to process the URL"}), 500

if __name__ == "__main__":
    app.run(debug=True)
