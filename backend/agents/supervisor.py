from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.content_agent import generate_content
from agents.progress_agent import (
    save_pre_quiz_result,
    save_delivered_content,
    save_post_quiz_result
)

# =========================
# SHARED STATE
# =========================
class LearningState(TypedDict):
    student_id: str
    subject: str
    lesson: str
    topic: str
    quiz: Optional[dict]
    student_answers: Optional[list]
    correct_answers: Optional[list]
    quiz_type: Optional[str]
    score: Optional[float]
    level: Optional[str]
    content: Optional[str]
    decision: Optional[str]
    next_agent: Optional[str]  #### orchestrator uses this to route


# =========================
# ORCHESTRATOR NODE
# =========================
def orchestrator_node(state: LearningState) -> LearningState:
    print("\n🎯 [Orchestrator] Analyzing state and deciding next agent")

    quiz_type = state.get("quiz_type")
    score = state.get("score")
    content = state.get("content")
    level = state.get("level")

    # --- PRE QUIZ FLOW ---
    if quiz_type == "pre":

        # Step 1: answers not evaluated yet
        if score is None:
            print("🎯 [Orchestrator] → Routing to EvaluatorAgent")
            return {**state, "next_agent": "evaluate"}

        # Step 2: evaluated but no content yet
        if content is None:
            print("🎯 [Orchestrator] → Routing to ContentGeneratorAgent")
            return {**state, "next_agent": "generate_content"}

        # Step 3: content ready → save progress
        print("🎯 [Orchestrator] → Routing to ProgressTrackerAgent")
        return {**state, "next_agent": "track_progress"}

    # --- POST QUIZ FLOW ---
    elif quiz_type == "post":

        # Step 1: answers not evaluated yet
        if score is None:
            print("🎯 [Orchestrator] → Routing to EvaluatorAgent")
            return {**state, "next_agent": "evaluate"}

        # Step 2: score < 6 → repeat lesson → generate content again
        if score < 6 and content is None:
            print("🎯 [Orchestrator] → Score low, routing to ContentGeneratorAgent")
            return {**state, "next_agent": "generate_content"}

        # Step 3: save progress
        print("🎯 [Orchestrator] → Routing to ProgressTrackerAgent")
        return {**state, "next_agent": "track_progress"}

    # Fallback
    print("🎯 [Orchestrator] → Nothing to do, ending")
    return {**state, "next_agent": "end"}


# =========================
# ROUTING FUNCTION
# =========================
def route_from_orchestrator(state: LearningState) -> str:
    return state.get("next_agent", "end")


# =========================
# AGENT NODES
# =========================
def evaluator_node(state: LearningState) -> LearningState:
    print("📊 [EvaluatorAgent] Evaluating answers...")

    result = evaluate_answers(
        state["student_answers"],
        state["correct_answers"]
    )

    return {
        **state,
        "score": result["score"],
        "level": result["level"]
    }


def content_generator_node(state: LearningState) -> LearningState:
    print("📚 [ContentGeneratorAgent] Generating lesson content...")

    content = generate_content(
        subject=state["subject"],
        lesson=state["lesson"],
        topic=state["topic"],
        level=state["level"]
    )

    return {**state, "content": content}


def progress_tracker_node(state: LearningState) -> LearningState:
    print("💾 [ProgressTrackerAgent] Saving progress to MongoDB...")

    quiz_type = state.get("quiz_type")

    if quiz_type == "pre":
        save_pre_quiz_result(
            student_id=state["student_id"],
            subject=state["subject"],
            lesson=state["lesson"],
            topic=state["topic"],
            level=state["level"],
            score=state["score"]
        )
        save_delivered_content(
            student_id=state["student_id"],
            subject=state["subject"],
            lesson=state["lesson"],
            topic=state["topic"],
            level=state["level"],
            content=state["content"]
        )

    else:  # post quiz
        save_post_quiz_result(
            student_id=state["student_id"],
            subject=state["subject"],
            lesson=state["lesson"],
            topic=state["topic"],
            score=state["score"]
        )

    return state


def decision_node(state: LearningState) -> LearningState:
    print("🔀 [DecisionAgent] Deciding next step...")

    score = state.get("score", 0)
    quiz_type = state.get("quiz_type")

    if quiz_type == "post":
        decision = "NEXT_TOPIC" if score >= 6 else "REPEAT_LESSON"
    else:
        decision = "CONTENT_READY"

    return {**state, "decision": decision}


# =========================
# BUILD GRAPH
# =========================
def build_learning_graph():

    graph = StateGraph(LearningState)

    # Add all nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("evaluate", evaluator_node)
    graph.add_node("generate_content", content_generator_node)
    graph.add_node("track_progress", progress_tracker_node)
    graph.add_node("decide", decision_node)

    # Entry point is always orchestrator
    graph.set_entry_point("orchestrator")

    # Orchestrator dynamically routes to next agent
    graph.add_conditional_edges(
        "orchestrator",
        route_from_orchestrator,
        {
            "evaluate": "evaluate",
            "generate_content": "generate_content",
            "track_progress": "track_progress",
            "end": END
        }
    )

    # After each agent → always return to orchestrator
    graph.add_edge("evaluate", "orchestrator")
    graph.add_edge("generate_content", "orchestrator")

    # After progress tracked → decision
    graph.add_edge("track_progress", "decide")
    graph.add_edge("decide", END)

    return graph.compile()


# Single compiled instance
learning_graph = build_learning_graph()