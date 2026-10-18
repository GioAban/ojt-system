package com.iodev.practicum.config;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Pinipilit ang student na magpalit ng password: habang "must change password" pa,
 * lahat ng /api/** (maliban sa change-password at auth) ay 403 na may code PASSWORD_CHANGE_REQUIRED.
 *
 * HUWAG lagyan ng @Component: kapag bean ito, ilalagay ito ng Spring Boot BAGO ang security
 * at hindi pa alam kung sino ang naka-login. Idagdag ito sa SecurityConfig, pagkatapos ng JwtAuthFilter:
 *   http.addFilterAfter(new PasswordChangeRequiredFilter(studentManagementRepository), JwtAuthFilter.class);
 */
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    private final StudentManagementRepository students;

    public PasswordChangeRequiredFilter(StudentManagementRepository students) {
        this.students = students;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/")
                || path.startsWith("/api/auth/")
                || path.startsWith("/api/enroll/")
                || path.equals("/api/student/change-password")
                // Kailangan ng app sa pag-load (kung sino ang naka-login at anong semester),
                // read-only lang ang mga ito, kaya hindi dapat harangin habang nagpapalit ng password
                || path.equals("/api/student/me")
                || path.equals("/api/student/profile")
                || ("GET".equalsIgnoreCase(request.getMethod()) && path.startsWith("/api/semesters"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            List<Student> found = students.findByEmail(auth.getName());
            if (!found.isEmpty() && Boolean.TRUE.equals(found.get(0).getMustChangePassword())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("text/plain;charset=UTF-8");
                response.getOutputStream().write("PASSWORD_CHANGE_REQUIRED".getBytes(StandardCharsets.UTF_8));
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
