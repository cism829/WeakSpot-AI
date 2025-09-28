import pdfplumber
import os
# from transformers import T5Tokenizer, T5ForConditionalGeneration
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

import warnings
warnings.filterwarnings("ignore", category=UserWarning)
from transformers import logging
logging.set_verbosity_error()

import spacy


print('importing model')
from dotenv import load_dotenv

load_dotenv()
my_api_key = os.getenv("OPENAI_API_KEY")

from openai import OpenAI
client = OpenAI(api_key=my_api_key)

# model_name = "google/flan-t5-large"
# tokenizer = AutoTokenizer.from_pretrained(model_name)
# model = AutoModelForSeq2SeqLM.from_pretrained(model_name)


original_text = ""
ai_text = []
example1 = "example_notes/example1.pdf"
example2 = "example_notes/example2.pdf"

ai_output = "ai_results/ai_fixed_notes_2_1.txt"

nlp = spacy.load("en_core_web_sm")

print("extracting file")
with pdfplumber.open(example2) as myPdf:
    for page in myPdf.pages:
        original_text += page.extract_text() + "\n"

# print(original_text)
print('proccessing notes')
notes = []
for line in original_text.split("\n"):
    line = line.strip()
    if line != "":
        notes.append(line)


def incomplete_def(line):
    line = line.strip()

    if line.endswith(":") or line.endswith("-"):
        print(line)
        return True 
    
    return False
    

def whole_def(word):
    print('getting definition')
    term = word.replace(":", "").replace("●", "").strip()

    prompt = f"Define the computer science term '{term}' clearly and accurately in 1 sentence. Keep it academic and concise."

    # prompt = f"Define the computer science term '{term}' in 1-2 sentences:"


    # prompt = f"Explain the term  '{term}' in simple words:"
    # prompt = f"Explain the computer term '{term}' in simple words."


    # input_ids = tokenizer.encode(prompt, return_tensors="pt")

    # output_ids = model.generate(
    #     input_ids,
    #     max_length=150,          
    #     min_length=30,           
    #     do_sample=True,
    #     temperature=0.8,
    #     top_p=0.9,
    #     repetition_penalty=1.3,  
    #     no_repeat_ngram_size=3,  
    #     early_stopping=True,
    #     pad_token_id=tokenizer.eos_token_id
    # )

    # definition = tokenizer.decode(output_ids[0], skip_special_tokens=True)


    response = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[{'role': 'user', 'content': prompt}],
    )
    definition = response.choices[0].message.content.strip()

    print(definition)
    usage = response.usage  # contains prompt_tokens, completion_tokens, total_tokens
    print(f"Prompt tokens: {usage.prompt_tokens}, "
          f"Completion tokens: {usage.completion_tokens}, "
          f"Total tokens: {usage.total_tokens}")
    
    return definition


def summarize_notes(text):
    print('summarizing')

    prompt = f"""Extract the main topic and 4 subtopics from the following notes. Output EXACTLY in this format:

Main Subject: <3-4 words>
Subtopics:
- <subtopic 1>
- <subtopic 2>
- <subtopic 3>
- <subtopic 4>

Rules:
- Use exactly 4 subtopics.
- Each subtopic: 1-3 words.
- Do NOT add extra sentences, explanations, or symbols.
- Output ONLY what is requested.

Notes:
{text[:3000]}
"""
    
    # input_ids = tokenizer.encode(prompt, return_tensors="pt", truncation=True)

    # output_ids = model.generate(
    #     input_ids,
    #     max_length=150,
    #     num_beams=5,
    #     early_stopping=True,
    #     no_repeat_ngram_size=2,
    #     pad_token_id=tokenizer.eos_token_id
    # )


#     output_ids = model.generate(
#         input_ids,
#         max_length=150,
#         min_length=40,
#         num_beams=5,            
#         do_sample=False,        
#         early_stopping=True,
#         no_repeat_ngram_size=2,
#         pad_token_id=tokenizer.eos_token_id
# )



    # summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # or "gpt-4" / "gpt-3.5-turbo"
        messages=[{"role": "user", "content": prompt}],
        temperature=0,          # deterministic output
        max_tokens=200
    )

    summary = response.choices[0].message.content.strip()

    return summary


print('ai filling in')
for line in notes:
    if incomplete_def(line):
        # print(line)
        definition = whole_def(line)
        ai_text.append(f"{line} {definition}")
    else:
        ai_text.append(line)

print("Summarizing notes...")
summary = summarize_notes(original_text)
print("Summary:\n", summary)


print('writing to file')

with open(ai_output, "w", encoding="utf-8") as new_note:
    for line in ai_text:
        new_note.write(line + "\n")
    new_note.write('\nSummary \n')
    new_note.write(summary)

print("done")