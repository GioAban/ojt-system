package com.iodev.practicum.service;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * Simpleng hangganan sa memorya (kagaya ng sa registration form), hal. "ip:forgot:1.2.3.4" 10 beses kada 15 minuto.
 * Nawawala kapag na-restart ang server; ang hangganan ng email kada address ay nasa database (EmailTokenService).
 */
@Component
public class RateLimiter {

    private static final int MAX_KEYS = 20_000;

    private final Map<String, Deque<Long>> hits = new HashMap<>();

    /** true = puwede (at binibilang ito); false = lampas na sa hangganan */
    public synchronized boolean allow(String key, int max, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> list = hits.get(key);
        if (list != null) {
            while (!list.isEmpty() && list.peekFirst() < now - windowMs) list.pollFirst();
        }
        if (list != null && list.size() >= max) return false;
        // Huwag hayaang lumaki nang walang hangganan ang memorya
        if (list == null && hits.size() >= MAX_KEYS) hits.clear();
        hits.computeIfAbsent(key, k -> new ArrayDeque<>()).addLast(now);
        return true;
    }
}
