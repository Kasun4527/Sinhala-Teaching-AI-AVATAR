def decide_next_step(score):
    if score < 40:
        return "repeat_easy"
    elif score < 70:
        return "repeat_medium"
    else:
        return "next"