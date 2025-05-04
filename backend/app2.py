# from flask import Flask, jsonify, request
# from flask_cors import CORS

# app = Flask(__name__)
# CORS(app)  # Enable CORS for the API route

# nouns ={
#     "water": "vand",
#     "liquid": "væske",
#     "substance": "substans",
#     "molecule": "molekyle",
#     "hydrogen": "brint",
#     "oxygen": "oxygen",
#     "solution": "opløsning",
#     "compound": "forbindelse",
#     "element": "element",
#     "bond": "binding",
#     "state": "tilstand",
#     "ice": "is",
#     "vapor": "damp",
#     "evaporation": "fordampning",
#     "condensation": "kondensering",
#     "freezing": "frysning",
#     "melting": "smeltning",
#     "temperature": "temperatur",
#     "pressure": "tryk",
#     "cycle": "cyklus"
# }

# verbs = {
#     "dissolve": "at opløse",
#     "freeze": "at fryse",
#     "melt": "at smelte",
#     "evaporate": "at fordampe",
#     "condense": "at kondensere",
#     "boil": "at koge",
#     "form": "at danne",
#     "react": "at reagere",
#     "mix": "at blande",
#     "transport": "at transportere",
#     "absorb": "at absorbere",
#     "release": "at frigive",
#     "change": "at ændre",
#     "move": "at bevæge sig",
#     "convert": "at konvertere",
#     "maintain": "at opretholde",
#     "regulate": "at regulere",
#     "interact": "at interagere",
#     "circulate": "at cirkulere",
#     "store": "at opbevare"
#   }



# @app.route("/get-replacements", methods=["GET"])
# def get_replacements():

#     # GET the URL sent from extension
#     url = request.args.get('url')
    
#     # For now, just print it to confirm
#     print(f"Received URL from extension: {url}")
    
#     return jsonify({
#         "nouns": nouns,
#         "verbs": verbs
#     })

# if __name__ == "__main__":
#     app.run(debug=True)
