import fitz

doc = fitz.open('Research paper/AI-Based Sinhala Assistant_V13.pdf')
b_list = set()
i_list = set()

for page in doc:
    for b in page.get_text('dict')['blocks']:
        if 'lines' in b:
            for l in b['lines']:
                for s in l['spans']:
                    text = s['text'].strip()
                    if len(text) > 2:
                        if 'Bold' in s['font']:
                            b_list.add(text)
                        if 'Italic' in s['font']:
                            i_list.add(text)

print('BOLD STRINGS:')
for t in list(b_list):
    print(t)
    
print('\nITALIC STRINGS:')
for t in list(i_list):
    print(t)
