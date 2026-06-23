# Implementation Plan 6: Emotional Wellness Module

## Objective
Implement journal entries, mood logging, breathing exercises, and weekly insights.

## Steps

### 6.1 Journal endpoints
- POST /wellness/journal: store encrypted content, trigger async sentiment analysis.
- GET list returns metadata only; GET detail returns encrypted content.
- DELETE with audit log.

### 6.2 Sentiment analysis
- Celery task nalyze_journal_sentiment calls Hugging Face model.
- Update sentiment_score and sentiment_label.
- If strongly negative, trigger recommendation task.

### 6.3 Mood logging
- POST /wellness/mood and GET /wellness/mood/history.
- Support intensity 1-5 and date range filters.

### 6.4 Breathing exercises
- GET /wellness/breathing-exercises for static content.
- POST completion to log session.

### 6.5 Weekly insights
- Celery task generate_weekly_insights computes trends and recommendations.
- Endpoint returns personalized suggestions.

## Validation Criteria
- Journal create triggers sentiment task.
- Mood history filters correctly.
- Insights return non-empty recommendations.
