"""
Grade 11 Buddhism RAG Prompt Generator
Generates contextual RAG prompts based on student performance and knowledge gaps
"""

from typing import Dict, List, Optional
import logging
from hybrid_bkt.inference import get_hybrid_mastery

logger = logging.getLogger(__name__)

class Grade11BuddhistRAGPromptGenerator:
    """
    Generates RAG (Retrieval-Augmented Generation) prompts for Grade 11 Buddhism
    Based on student mastery levels, skill gaps, and learning objectives
    """
    
    def __init__(self):
        self.skill_to_content_mapping = {
            "identify_special_events": {
                "content_focus": "බුදු සිරිතේ විශේෂ සිදුවීම්",
                "retrieval_query": "Buddha's special events and challenges"
            },
            "acknowledge_buddhist_challenges": {
                "content_focus": "අභියෝගවලට සාර්ථකව මුහුණ දෙම",
                "retrieval_query": "How Buddha overcome challenges and adversity"
            },
            "apply_buddha_principles_to_life": {
                "content_focus": "ශිෂ්‍ය ජීවිතයට බුදු ගුණ යෙදීම",
                "retrieval_query": "Applying Buddhist principles to student life"
            },
            "identify_buddha_qualities": {
                "content_focus": "බුදු සිරිතේ ගුණාංග",
                "retrieval_query": "Buddha's unique qualities and virtues"
            },
            "recognize_compassion_in_healing": {
                "content_focus": "සුවඩු කිරීමේ දී කරුණාව",
                "retrieval_query": "Compassion in healing and service"
            },
            "apply_service_to_sick": {
                "content_focus": "ගිලනුන්ට සේවය කිරීම",
                "retrieval_query": "Serving the sick and suffering"
            },
            "understand_buddha_medicine_practice": {
                "content_focus": "බුද්ධ වෛද්‍ය ශිල්ප",
                "retrieval_query": "Buddha's approach to medicine and healthcare"
            }
        }
    
    def generate_rag_prompt_for_pre_quiz(self, kc_id: str, kc_name: str) -> str:
        """
        Generate RAG prompt for pre-quiz (before learning content)
        Focus on foundational concepts
        """
        prompt = f"""
📚 RETRIEVAL PROMPT FOR GRADE 11 BUDDHISM - PRE-LEARNING
==================================================

KNOWLEDGE COMPONENT: {kc_name}
IDENTIFIER: {kc_id}
PURPOSE: Generate foundational learning material

REQUEST:
Please retrieve and provide clear, age-appropriate explanations for:

1. Core Concepts:
   - Definition and overview of {kc_name}
   - Key historical events and figures related to this topic
   - Relevance to student life and modern context

2. Learning Objectives:
   - Key facts students need to know
   - Important relationships and connections
   - Practical applications

3. Content Structure:
   - Introduction to the topic
   - Main concepts (with examples)
   - Connection to Buddhist values
   - Student reflection questions

CONTEXT: Grade 11 students (Age 16-17)
LANGUAGE: Bilingual (Sinhala concepts with English explanations)
FORMAT: Clear, structured, engaging content

⚡ Additional instructions:
- Use relevant stories and examples from Buddhist scriptures
- Include practical applications to student life
- Highlight connections to other learned topics
- Provide engaging hooks to increase motivation
"""
        return prompt
    
    def generate_rag_prompt_for_post_quiz(
        self,
        student_id: str,
        kc_id: str,
        kc_name: str,
        score: float,
        score_percentage: float,
        correct_responses: List[bool],
        skill_tags: List[str],
        mastery_level: float
    ) -> str:
        """
        Generate adaptive RAG prompt for post-quiz (after assessment)
        Focus on reinforcement or remediation based on performance
        """
        
        # Determine performance level
        if mastery_level > 0.85:
            performance_level = "ADVANCED"
            feedback_type = "Enrichment and Extension"
            depth = "deep"
        elif mastery_level > 0.6:
            performance_level = "INTERMEDIATE"
            feedback_type = "Reinforcement and Practice"
            depth = "moderate"
        else:
            performance_level = "NEEDS SUPPORT"
            feedback_type = "Remediation and Clarification"
            depth = "foundational"
        
        # Identify weak skills
        weak_skills = []
        for i, is_correct in enumerate(correct_responses):
            if not is_correct and i < len(skill_tags):
                weak_skills.append(skill_tags[i])
        
        weak_skills_unique = list(set(weak_skills))
        
        # Generate focus areas
        focus_areas = []
        for skill in weak_skills_unique[:2]:  # Top 2 weak areas
            if skill in self.skill_to_content_mapping:
                focus_areas.append(self.skill_to_content_mapping[skill]["content_focus"])
        
        prompt = f"""
📊 ADAPTIVE RETRIEVAL PROMPT FOR GRADE 11 BUDDHISM - POST-LEARNING
================================================================

STUDENT PERFORMANCE SUMMARY:
- Knowledge Component: {kc_name} ({kc_id})
- Score: {score_percentage}% ({score}/questions)
- Mastery Level: {mastery_level:.1%}
- Performance Tier: {performance_level}

REQUIRED CONTENT TYPE: {feedback_type}
DEPTH LEVEL: {depth}

FOCUS AREAS FOR RETRIEVAL:
{chr(10).join([f'• {area}' for area in focus_areas]) if focus_areas else '• General review of all concepts'}

REQUEST:
Please retrieve and provide {performance_level.lower()}-appropriate content:

1. For {performance_level} Learners:
"""
        
        if performance_level == "ADVANCED":
            prompt += """
   - Challenge questions and deeper analysis
   - Connections to higher-level Buddhist philosophy
   - Real-world application scenarios
   - Opportunities for creative thinking
   - Extension activities for mastery pursuit
"""
        elif performance_level == "INTERMEDIATE":
            prompt += """
   - Practical examples reinforcing key concepts
   - Common misconceptions to address
   - Step-by-step explanations
   - Practice scenarios similar to quiz questions
   - Tips for remembering difficult concepts
"""
        else:
            prompt += """
   - Clear, simple explanations of struggled concepts
   - Concrete examples from student experiences
   - Step-by-step learning paths
   - Key definitions and simple summaries
   - Encouraging guidance and support
"""
        
        prompt += f"""

2. Specific Topics to Address (from weak areas):
{chr(10).join([f'   • Clarify misconceptions about {skill}' for skill in weak_skills_unique[:3]])}

3. Content Format:
   - Explanation of core concepts
   - Real-world examples relevant to students
   - Visual descriptions or scenarios
   - Practice tips and memory aids
   - Progress guidance

4. Engagement Strategy:
   - Use motivational language
   - Highlight student progress
   - Connect to student interests
   - Provide clear next steps

⚡ Context:
- Student is at {performance_level} mastery level
- Priority: {feedback_type}
- Target understanding: {mastery_level:.1%} completion
- Learning style: Adaptive based on performance

📍 GENERATE PERSONALIZED CONTENT that:
1. Addresses current knowledge gaps
2. Builds on existing understanding
3. Motivates continued learning
4. Provides clear pathways forward
"""
        
        return prompt
    
    def generate_rag_prompt_for_student_interaction(
        self,
        student_id: str,
        interaction_history: Dict,
        current_kc: str
    ) -> str:
        """
        Generate RAG prompt based on student interaction patterns
        """
        
        prompt = f"""
🔄 PERSONALIZED LEARNING RETRIEVAL REQUEST
==========================================

STUDENT PROFILE:
- Student ID: {student_id}
- Current Focus: {current_kc}
- Previous Attempts: {interaction_history.get('total_attempts', 0)}

LEARNING PATTERN ANALYSIS:
- Strengths: {', '.join(interaction_history.get('strong_skills', [])[:2]) if interaction_history.get('strong_skills') else 'Not determined yet'}
- Areas for Growth: {', '.join(interaction_history.get('weak_skills', [])[:2]) if interaction_history.get('weak_skills') else 'Being assessed'}

REQUEST:
Generate personalized content that:

1. Builds on Student Strengths
   - Leverage demonstrated competencies
   - Create confidence through success
   - Provide opportunities for leadership/mentoring

2. Addresses Growth Areas
   - Provide targeted instruction
   - Use varied explanations
   - Build understanding step-by-step

3. Learning Preferences
   - Practical, real-world examples
   - Stories and narratives
   - Connections to previous learning
   - Clear, organized structure

4. Engagement Hooks
   - Relevance to student life
   - Challenging but achievable tasks
   - Opportunities for reflection
   - Clear progress indicators

📌 Tailor content to Grade 11 students (Age 16-17) in an online learning environment
"""
        
        return prompt
    
    def generate_comprehensive_rag_prompt(
        self,
        student_id: str,
        kc_id: str,
        kc_name: str,
        quiz_type: str = "pre",
        score: Optional[float] = None,
        score_percentage: Optional[float] = None,
        correct_responses: Optional[List[bool]] = None,
        skill_tags: Optional[List[str]] = None,
        mastery_level: Optional[float] = None
    ) -> Dict[str, str]:
        """
        Generate comprehensive RAG system prompt package
        Returns both the retrieval prompt and system context
        """
        
        if quiz_type == "pre":
            retrieval_prompt = self.generate_rag_prompt_for_pre_quiz(kc_id, kc_name)
        else:
            retrieval_prompt = self.generate_rag_prompt_for_post_quiz(
                student_id, kc_id, kc_name, score, score_percentage,
                correct_responses or [], skill_tags or [], mastery_level or 0.0
            )
        
        system_context = f"""
SYSTEM CONTEXT FOR CONTENT GENERATION:
- Subject: Grade 11 Buddhism
- Knowledge Component: {kc_name} ({kc_id})
- Quiz Type: {quiz_type.upper()}
- Student Proficiency Level: {mastery_level if mastery_level else 'Not yet assessed'}
- Language: Bilingual (Sinhala + English)
- Target Audience: 16-17 year old students
"""
        
        return {
            "system_context": system_context,
            "retrieval_prompt": retrieval_prompt,
            "kc_id": kc_id,
            "student_id": student_id,
            "quiz_type": quiz_type,
            "mastery_level": mastery_level or 0.0
        }

def get_rag_prompt_for_quiz_feedback(
    student_id: str,
    kc_id: str,
    kc_name: str,
    quiz_response: Dict
) -> Dict[str, str]:
    """
    Convenience function to get RAG prompt from quiz response
    """
    generator = Grade11BuddhistRAGPromptGenerator()
    
    return generator.generate_comprehensive_rag_prompt(
        student_id=student_id,
        kc_id=kc_id,
        kc_name=kc_name,
        quiz_type="post",
        score=quiz_response.get("score", 0),
        score_percentage=quiz_response.get("score_percentage", 0),
        correct_responses=quiz_response.get("correct_responses", []),
        skill_tags=quiz_response.get("skill_tags", []),
        mastery_level=quiz_response.get("mastery_level", 0.0)
    )

if __name__ == "__main__":
    generator = Grade11BuddhistRAGPromptGenerator()
    
    # Example: Pre-quiz prompt
    print("=" * 60)
    print("PRE-QUIZ PROMPT EXAMPLE")
    print("=" * 60)
    pre_prompt = generator.generate_rag_prompt_for_pre_quiz(
        "11.1.1",
        "බුදු සිරිතේ සුවිශේෂී සිදුවීම්"
    )
    print(pre_prompt[:500] + "...")
    
    # Example: Post-quiz prompt
    print("\n" + "=" * 60)
    print("POST-QUIZ PROMPT EXAMPLE")
    print("=" * 60)
    post_prompt = generator.generate_rag_prompt_for_post_quiz(
        student_id="STU001",
        kc_id="11.1.1",
        kc_name="බුදු සිරිතේ සුවිශේෂී සිදුවීම්",
        score=3,
        score_percentage=75.0,
        correct_responses=[True, True, False, True],
        skill_tags=["identify_special_events", "apply_buddha_principles_to_life"],
        mastery_level=0.72
    )
    print(post_prompt[:500] + "...")
