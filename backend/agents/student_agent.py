def get_level(score):
    if score < 40:
        return "beginner"
    elif score < 70:
        return "intermediate"
    else:
        return "advanced"