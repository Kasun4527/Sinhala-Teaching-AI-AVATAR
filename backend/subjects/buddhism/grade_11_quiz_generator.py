"""
Grade 11 Buddhism Quiz Generator with Skill Tags and Difficulty Levels
Aligned with Knowledge Components and Learning Outcomes
"""

import pandas as pd
import uuid
from datetime import datetime

class Grade11BuddhistQuizGenerator:
    """
    Generates high-quality quiz questions for Grade 11 Buddhism
    Based on lesson content and knowledge components
    """
    
    def __init__(self):
        self.questions = []
        self.lesson_1_kcs = {
            "11.1.1": {
                "name": "බුදු සිරිතේ සුවිශේෂී සිදුවීම් ආදර්ශයට ගනිමින් ජීවිත අභියෝගවලට සාර්ථකව මුහුණ දෙයි",
                "skills": [
                    "acknowledge_buddhist_challenges",
                    "apply_buddha_principles_to_life",
                    "identify_special_events",
                    "analyze_triumph_over_adversity"
                ]
            },
            "11.1.2": {
                "name": "බුදු සිරිතේ සුවිශේෂී ගුණාංග හැඳින ජීවිතාදර්ශ ලබා කටයුතු කරයි",
                "skills": [
                    "identify_buddha_qualities",
                    "explain_virtues_in_life",
                    "apply_compassion_to_others",
                    "understand_service_ethics"
                ]
            }
        }
        
        self.lesson_2_kcs = {
            "11.2.1": {
                "name": "බුදු ගුණ අනන්තය - සිරුර සුවඩු කිරීම සහ මානසික සහනීයතා",
                "skills": [
                    "identify_healthcare_principles",
                    "recognize_compassion_in_healing",
                    "apply_service_to_sick",
                    "understand_buddha_medicine_practice",
                    "analyze_nurse_responsibilities"
                ]
            }
        }
        
    def add_question(self, kc_id, skill, question_text, options, correct_answer, 
                    difficulty, question_type="mcq", blooms_level="remember"):
        """Add a question to the quiz bank"""
        question = {
            "question_id": str(uuid.uuid4()),
            "kc_id": kc_id,
            "skill_tag": skill,
            "question_text": question_text,
            "option_a": options["a"],
            "option_b": options["b"],
            "option_c": options["c"],
            "option_d": options["d"],
            "correct_answer": correct_answer,
            "difficulty": difficulty,
            "question_type": question_type,
            "blooms_level": blooms_level,
            "timestamp": datetime.now().isoformat()
        }
        self.questions.append(question)
        return question
    
    def generate_lesson_1_questions(self):
        """Generate questions for Lesson 1: Buddha's Triumph over Challenges"""
        
        # Easy Level - Remember (Blooms L1)
        self.add_question(
            "11.1.1",
            "identify_special_events",
            "බුදු සිරිතේ විශේෂ සිදුවීම් අතුරින් ප්‍රධානතම සිදුවීම වූයේ කුමක්ද?",
            {"a": "බුද්ධත්වයට පත්වීම", "b": "නිවන්‍ට ගිම්හාණ", "c": "ප්‍රාර්ථනාව", "d": "අධ්‍යපනය"},
            "a", "easy", blooms_level="remember"
        )
        
        self.add_question(
            "11.1.1",
            "identify_special_events",
            "බුදුරජාණන් වහන්සේ ඳිගු කලක් පසුවත් තනතුරු ප්‍රදානය කිරීමේ දී අනුගමනය කළ මිතුරු තීරණ ඉතිහාසිතු කුමක්ද?",
            {"a": "ගෝත්‍රය හා කුලය", "b": "සෘජු කුසලතාවය", "c": "නිතිකම", "d": "මිතුරුත්වය"},
            "b", "easy", blooms_level="remember"
        )
        
        self.add_question(
            "11.1.1",
            "acknowledge_buddhist_challenges",
            "බුදුරජාණන් වහන්සේට බුද්ධත්වයක් ගෙන ගිය ප්‍රධාන අභියෝගය කුමක්ද?",
            {"a": "දස මාර සේනා පරාජය කිරීම", "b": "ගිරිහ වැඩිම අධිකරණය", "c": "ප්‍රශාසනිකයින්ගේ විරෝධතාවය", "d": "භිකුවරුන්ගේ අවනිතිය"},
            "a", "easy", blooms_level="remember"
        )
        
        # Medium Level - Understand (Blooms L2)
        self.add_question(
            "11.1.1",
            "apply_buddha_principles_to_life",
            "බුදුරජාණන් වහන්සේ පස්වග තවුසන්ට ධර්මය දේශනා කිරීමට පෙර ඔවුන්ට ඉතුරු කුමක්ද?",
            {"a": "බුද්ධත්වයට පිළිගැනීම", "b": "සිතිවිල්ල වෙනස් කිරීම", "c": "දර්ශනය කිරීම", "d": "ව්‍යක්තිගත පරීක්ෂණ"},
            "a", "medium", blooms_level="understand"
        )
        
        self.add_question(
            "11.1.1",
            "analyze_triumph_over_adversity",
            "බුදුරජාණන් වහන්සේ වේරංජා පුරයේ වස් විසුවිට ඔහු හමුවූ අස්ඨර අවස්ථාවලින් කුමක් උගිරුවිණි?",
            {"a": "ඉවසීම හා අධිෂ්ඨානය අත්‍යාවශ්‍යයි", "b": "සෙනෙහස් නොපිණිසිය", "c": "ධර්මය පුළුවන්ට ගිණිතිය නොතුමිණි", "d": "බිඹුර වෙනුවෙන් බිඹුර ගිණිතිය"},
            "a", "medium", blooms_level="understand"
        )
        
        # Hard Level - Apply/Analyze (Blooms L3/L4)
        self.add_question(
            "11.1.1",
            "analyze_triumph_over_adversity",
            "බුදුරජාණන් වහන්සේ තනතුරු ප්‍රදානයේ දී චන්නා හිමි අතෘප්තිමත් වුවද ඔහු පරිමාණ කිරීමට නොබිඳුවනුයේ කෙසේද?",
            {"a": "අපේක්ෂාවෙන් මුහුණ දුන් නිසා", "b": "කුසලතාවය මතක් කර ගත්තේ නිසා", "c": "දැඩිතා සිසු කරන්නට සිටි නිසා", "d": "සිතිවිල්ල නිරුපාධ විය නිසා"},
            "a", "hard", blooms_level="analyze"
        )
        
        self.add_question(
            "11.1.1",
            "apply_buddha_principles_to_life",
            "බුදුරජාණන්ගේ ජීවිතයෙන් ශිෂ්‍යවරුන් ශිෂ්‍යා වශයෙන් අපට අවගුණ විය හැකි වඩාතුරටත් වැදගත් පාඩමක්ට නුවනින් වෙනුවෙන් බිඹුර ගිණිතිය විය?",
            {"a": "අභියෝග සුවඳු කිරීම සඳහා අධිෂ්ඨානය අවශ්‍යයි", "b": "සිතිවිල්ල පිතුරුවිය යුතුයි", "c": "තිරිසන්ටුන්ට ක්‍රිස්කම කිරීම අවශ්‍යයි", "d": "විසුවිවිධ දැකීම අවශ්‍යයි"},
            "a", "hard", blooms_level="analyze"
        )
        
    def generate_lesson_2_questions(self):
        """Generate questions for Lesson 2: Buddha's Infinite Virtues - Compassion & Service"""
        
        # Easy Level - Remember
        self.add_question(
            "11.2.1",
            "identify_healthcare_principles",
            "පූතිගත්ත තිස්ස තෙරුන්ගේ රෝගයේ ලක්ෂණ කුමක්ද?",
            {"a": "සිරුරේ බිබිළි හටගැනිම", "b": "උදරාබාධ", "c": "කණ්ඩුවාසි", "d": "ඇසින් රෝගය"},
            "a", "easy", blooms_level="remember"
        )
        
        self.add_question(
            "11.2.1",
            "recognize_compassion_in_healing",
            "බුදුරජාණන් වහන්සේ පූතිගත්ත තිස්ස තෙරුන්ට සහාය දුන්නේ කිවිතරේ කුමක් නිසාද?",
            {"a": "තෙරුන්ගේ බිඹුරු අයිතිවාසිකම", "b": "ශ්‍රැවක සමාජයේ පිඩිතම", "c": "ඔසේ කරුණා සිතුවිල්ල", "d": "බිඹුර නීතිමය කර්තව්‍යය"},
            "c", "easy", blooms_level="remember"
        )
        
        # Medium Level - Understand
        self.add_question(
            "11.2.1",
            "apply_service_to_sick",
            "බුදුරජාණන් වහන්සේ ගිලනුන්ට උපස්ථාන කිරීම සඳහා කුමක් පිතුරුවෙන් ඐතිවිශ්‍යෙන් කර ඇත්තේ නම්?",
            {"a": "ගිලනුන්ට උපස්ථාන කිරීම බුද්ධ පූජාව බව පිතුරුවීම", "b": "ගිලනුන්ට නිරිසි කිරීම පිළිබඳ ගුරුවරුන්ගේ නිර්දේශ", "c": "වෛද්‍යවරුන්ගේ ක්‍රියාවලිය අනුගමනය කිරීම", "d": "සිසුවරුන්ගේ නිතිකම උගනිමු"},
            "a", "medium", blooms_level="understand"
        )
        
        self.add_question(
            "11.2.1",
            "understand_buddha_medicine_practice",
            "බුදුරජාණන් වහන්සේ ගිලනුන්ට උපස්ථාන කරන්නකු තුළ තිබිය යුතු ගුණාංග කිහිපයක් කුමක්ද?",
            {"a": "මුහුණ ඐතිවිශ්‍යේ හා අධිෂ්ඨානය", "b": "එකිනෙකා හිතකිරි සිතුවිල්ල හා සිතිවිල්ල අධිෂ්ඨානය", "c": "බිඹුර ගිණිතිය හා කරුණා", "d": "සිතිවිල්ල අධිෂ්ඨානය සිතුවිල්ල"},
            "c", "medium", blooms_level="understand"
        )
        
        # Hard Level - Apply/Analyze
        self.add_question(
            "11.2.1",
            "analyze_nurse_responsibilities",
            "ගිලනු උපස්ථාන කිරීමේ දී බිඹුර ස්වභාවයක් පිතුරුවීම සිතිවිල්ල කිරීමෙන් කුමක් ප්‍රතිඵලයක් ලබා ගත හැකිද?",
            {"a": "සිතිවිල්ල උපස්ථාන ස්වභාවයක් ඇති කිරීම", "b": "කරුණා සිතුවිල්ල බිඹුර දේ සිතිවිල්ල", "c": "බිඹුර ගිණිතිය සඳහා එකිනෙකා ඔවුනොවුන්ට උපකාරී වීම", "d": "බිඹුර විඩුවීම ඔවුනොවුන්ගේ සඳහා"},
            "c", "hard", blooms_level="analyze"
        )
        
        self.add_question(
            "11.2.1",
            "apply_service_to_sick",
            "බුදුරජාණන් වහන්සේ උපස්ථාන කිරීම පිළිබඳ අවවාදයෙන් පසුව භිකුවරුන්ගේ ගිලනු උපස්ථාන සිතිවිල්ල කුමක් බවට පතිරුවිණි?",
            {"a": "ගිලනු උපස්ථාන කිරීම බුද්ධ පූජාවක් බවට පතිරුවිණි", "b": "ගිලනු උපස්ථාන කිරීම නිතිකම කිරීම බවට පතිරුවිණි", "c": "ගිලනු උපස්ථාන කිරීම විඩුවීම බවට පතිරුවිණි", "d": "ගිලනු උපස්ථාන කිරීම ක්‍රිස්කම බවට පතිරුවිණි"},
            "a", "hard", blooms_level="analyze"
        )

    def generate_critical_thinking_questions(self):
        """Generate critical thinking and application-based questions"""
        
        self.add_question(
            "11.1.2",
            "analyze_triumph_over_adversity",
            "ශිෂ්‍ය ජීවිතයේ දී ඇතිවිය හැකි අභියෝග අතුරින් බුදුරජාණන්ගේ මාර බලවේගවලට සම සම්බන්ධිත ගැටලුවක් කුමක් විය හැකිද?",
            {"a": "කර්තවතාවයේ හා ඉගෙනුමේ අබිබලය", "b": "නිර්දිෂ්ට සිතුවිල්ල සිතිවිල්ල හා ක්‍රිස්කම", "c": "තරුණ ස්ව අවිවේකතාවය හා කුසගින්න", "d": "බිඹුර නිතිකම සඳහා බිඹුර නිතිකම"},
            "c", "hard", blooms_level="evaluate"
        )
        
        self.add_question(
            "11.2.1",
            "understand_buddha_medicine_practice",
            "ගිලනු උපස්ථාන කිරීමේ දී වෛද්‍යවරයාගේ සේවය සහ උපස්ථායකයාගේ සේවයෙන් ඔබ කුමක් වටහා ගනිද?",
            {"a": "වෛද්‍යවරයා වඩා වැදගත්ය", "b": "දෙකම සමාන වැදගත්ය", "c": "උපස්ථායකයා වඩා වැදගත්ය", "d": "සිතිවිල්ල නිතිකම ගිණිතිය"},
            "b", "hard", blooms_level="analyze"
        )

    def export_to_csv(self, filename="grade_11_buddhism_quiz_bank.csv"):
        """Export questions to CSV format"""
        df = pd.DataFrame(self.questions)
        # Reorder columns for readability
        columns = [
            'question_id', 'kc_id', 'skill_tag', 'blooms_level', 'difficulty',
            'question_type', 'question_text', 'option_a', 'option_b', 'option_c',
            'option_d', 'correct_answer', 'timestamp'
        ]
        df = df[columns]
        df.to_csv(filename, index=False, encoding='utf-8')
        return df
    
    def export_to_json(self, filename="grade_11_buddhism_quiz_bank.json"):
        """Export questions to JSON format"""
        import json
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.questions, f, ensure_ascii=False, indent=2)
        return len(self.questions)

def generate_complete_quiz_bank():
    """Generate complete Grade 11 Buddhism quiz bank"""
    generator = Grade11BuddhistQuizGenerator()
    
    # Generate all questions
    print("📚 Generating Lesson 1 Questions...")
    generator.generate_lesson_1_questions()
    
    print("📚 Generating Lesson 2 Questions...")
    generator.generate_lesson_2_questions()
    
    print("🧠 Generating Critical Thinking Questions...")
    generator.generate_critical_thinking_questions()
    
    # Export to formats
    print("\n💾 Exporting to CSV...")
    csv_path = "backend/data/grade_11_buddhism_quiz_bank.csv"
    df = generator.export_to_csv(csv_path)
    print(f"✅ CSV exported: {csv_path}")
    print(f"📊 Total questions generated: {len(generator.questions)}")
    
    print("\n💾 Exporting to JSON...")
    json_path = "backend/data/grade_11_buddhism_quiz_bank.json"
    generator.export_to_json(json_path)
    print(f"✅ JSON exported: {json_path}")
    
    # Display summary
    print("\n📈 Quiz Bank Summary:")
    print(f"Total Questions: {len(generator.questions)}")
    difficulty_dist = df['difficulty'].value_counts().sort_index()
    print(f"Difficulty Distribution:\n{difficulty_dist}")
    
    blooms_dist = df['blooms_level'].value_counts()
    print(f"\nBlooms Level Distribution:\n{blooms_dist}")
    
    return generator.questions

if __name__ == "__main__":
    questions = generate_complete_quiz_bank()
