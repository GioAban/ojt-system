package com.iodev.practicum.security;

import com.iodev.practicum.model.Director;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.User;
import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DirectorRepository directorRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null) {
            return org.springframework.security.core.userdetails.User
                    .withUsername(user.getEmail())
                    .password(user.getPassword())
                    .authorities(new SimpleGrantedAuthority("ROLE_" + user.getRoleAs().name()))
                    .disabled(Boolean.TRUE.equals(user.getIsArchived()))
                    .build();
        }

        Director director = directorRepository.findByEmail(email).orElse(null);
        if (director != null) {
            return new org.springframework.security.core.userdetails.User(
                    director.getEmail(),
                    director.getPassword(),
                    List.of(new SimpleGrantedAuthority("ROLE_DIRECTOR"))
            );
        }

        Student student = studentRepository.findByEmail(email).orElse(null);
        if (student != null && !Boolean.TRUE.equals(student.getIsArchived())) {
            return new org.springframework.security.core.userdetails.User(
                    student.getEmail(),
                    student.getPassword(),
                    List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
            );
        }

        throw new UsernameNotFoundException("No account found with email: " + email);
    }
}