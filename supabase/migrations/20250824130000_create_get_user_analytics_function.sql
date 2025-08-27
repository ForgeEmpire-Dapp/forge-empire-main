-- Create get_user_analytics function (Optimized & Corrected)
CREATE OR REPLACE FUNCTION public.get_user_analytics(p_user_address TEXT)
RETURNS TABLE(
  profileViews BIGINT,
  totalLikes BIGINT,
  totalComments BIGINT,
  totalShares BIGINT,
  followerGrowth BIGINT,
  engagementRate NUMERIC,
  lastActiveAt TIMESTAMP WITH TIME ZONE,
  joinedAt TIMESTAMP WITH TIME ZONE,
  topContent JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_followers BIGINT;
    v_total_posts BIGINT;
    v_total_engagement_on_posts BIGINT;
BEGIN
    -- Get total followers, handling the case where the user has none.
    SELECT COUNT(*) INTO v_total_followers
    FROM public.social_follows
    WHERE following_address = p_user_address;

    -- Use a CTE to calculate engagement on posts authored by the user.
    -- This is far more efficient than the original correlated subquery.
    WITH user_posts_engagement AS (
        SELECT
            p.id,
            p.type,
            p.title,
            COUNT(a.id) FILTER (WHERE a.type IN ('like', 'comment', 'share')) AS engagement_count
        FROM public.posts p
        LEFT JOIN public.activities a ON a.metadata->>'post_id' = p.id
        WHERE p.author_address = p_user_address
        GROUP BY p.id, p.type, p.title
    )
    -- Aggregate post stats to avoid re-calculating
    SELECT
        SUM(upe.engagement_count),
        COUNT(upe.id),
        jsonb_agg(t)
    INTO
        v_total_engagement_on_posts,
        v_total_posts,
        get_user_analytics.topContent
    FROM (
        SELECT upe.type, upe.title, upe.engagement_count AS engagement
        FROM user_posts_engagement upe
        ORDER BY engagement_count DESC
        LIMIT 3
    ) t, user_posts_engagement upe;

    RETURN QUERY
    -- Final SELECT combining all analytics efficiently
    SELECT
        -- profileViews: Fetched from analytics_events table
        (SELECT COUNT(*) FROM public.analytics_events WHERE event_name = 'profile_view' AND event_properties->>'viewed_user_address' = p_user_address) AS profileViews,

        -- totalLikes, totalComments, totalShares: Actions *by* the user, calculated in a single pass
        (SELECT COUNT(*) FROM public.activities WHERE type = 'like' AND user_address = p_user_address) AS totalLikes,
        (SELECT COUNT(*) FROM public.activities WHERE type = 'comment' AND user_address = p_user_address) AS totalComments,
        (SELECT COUNT(*) FROM public.activities WHERE type = 'share' AND user_address = p_user_address) AS totalShares,

        -- followerGrowth: New followers in the last 30 days
        (SELECT COUNT(*) FROM public.social_follows WHERE following_address = p_user_address AND created_at >= (now() - interval '30 days')) AS followerGrowth,

        -- engagementRate: Corrected logic - (total engagement on posts / total posts)
        -- This measures engagement per post. Multiplying by followers is also a valid strategy.
        (SELECT
            CASE
                WHEN v_total_posts > 0 THEN
                    (v_total_engagement_on_posts::NUMERIC / v_total_posts)
                ELSE 0
            END
        ) AS engagementRate,

        -- lastActiveAt: The user's last recorded action
        (SELECT MAX(timestamp) FROM public.activities WHERE user_address = p_user_address) AS lastActiveAt,

        -- joinedAt: The user's profile creation date
        (SELECT created_at FROM public.profiles WHERE user_address = p_user_address) AS joinedAt,

        -- topContent: Pre-calculated using the CTE
        get_user_analytics.topContent;
END;
$$;