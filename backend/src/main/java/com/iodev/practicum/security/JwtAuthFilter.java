package com.iodev.practicum.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                      @NonNull HttpServletResponse response,
                                      @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String token = null;
        String email = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
            try {
                email = jwtUtil.extractEmail(token);
            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                // Pareho pa rin ang sagot (hindi naka-login), pero alam ng app na nag-expire lang ang token
                // para itabi ang ginagawa offline at hilinging mag-login ulit
                response.setHeader("X-Auth-Error", "TOKEN_EXPIRED");
            } catch (Exception e) {
                // Invalid token, ipapasa na lang sa filter chain, mare-reject sa ibang layer
            }
        }

        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = null;
            try {
                userDetails = userDetailsService.loadUserByUsername(email);
            } catch (UsernameNotFoundException e) {
                // Lumang token ng account na wala na: ituring na hindi naka-login para hindi masira ang mga public page
            }

            if (userDetails != null && userDetails.isEnabled() && jwtUtil.isTokenValid(token, email)
                    && !issuedBeforePasswordChange(userDetails, token)) {
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Token na ginawa bago na-reset ang password (password_changed_at). Segundo ang hinahambing dahil
     * segundo lang ang iat ng JWT. null na password_changed_at = tinatanggap kagaya ng dati.
     */
    private boolean issuedBeforePasswordChange(UserDetails userDetails, String token) {
        if (!(userDetails instanceof AccountDetails a) || a.getPasswordChangedAt() == null) return false;
        java.util.Date issued = jwtUtil.extractIssuedAt(token);
        if (issued == null) return true;
        long changed = a.getPasswordChangedAt().atZone(java.time.ZoneId.systemDefault()).toEpochSecond();
        return issued.getTime() / 1000 < changed;
    }
}