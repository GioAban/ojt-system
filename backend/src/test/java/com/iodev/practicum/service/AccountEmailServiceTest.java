package com.iodev.practicum.service;

import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import com.iodev.practicum.repository.UserRepository;
import com.iodev.practicum.service.AccountEmailService.Exclude;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Isang email, isang account: bawat table ay humaharang, at hindi hinaharangan ng account ang sarili niya. */
class AccountEmailServiceTest {

    private static final String EMAIL = "juan@ucu.edu.ph";

    private UserRepository users;
    private DirectorRepository directors;
    private StudentManagementRepository students;
    private StudentRegistrationRepository registrations;
    private AccountEmailService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        directors = mock(DirectorRepository.class);
        students = mock(StudentManagementRepository.class);
        registrations = mock(StudentRegistrationRepository.class);
        service = new AccountEmailService(users, directors, students, registrations);
    }

    @Test
    void messageIsPlainEnglish() {
        assertEquals("This email is already in use.", AccountEmailService.IN_USE);
    }

    @Test
    void freeEmailIsNotInUse() {
        assertFalse(service.inUse(EMAIL, Exclude.NONE));
    }

    @Test
    void comparesTrimmedAndLowerCase() {
        when(users.emailInUse(EMAIL)).thenReturn(true);
        assertTrue(service.inUse("  Juan@UCU.edu.PH ", Exclude.NONE));
    }

    @Test
    void blankEmailIsNeverInUseAndQueriesNothing() {
        assertFalse(service.inUse("   ", Exclude.NONE));
        assertFalse(service.inUse(null, null));
        verifyNoInteractions(users, directors, students, registrations);
    }

    @Test
    void coordinatorOrStaffEmailBlocks() {
        when(users.emailInUse(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.NONE));
    }

    @Test
    void directorEmailBlocks() {
        when(directors.emailInUse(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.NONE));
    }

    @Test
    void studentEmailBlocks() {
        when(students.emailExists(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.NONE));
    }

    @Test
    void pendingRegistrationBlocks() {
        when(registrations.emailTaken(EMAIL, null)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.NONE));
    }

    @Test
    void coordinatorEditDoesNotBlockItsOwnEmail() {
        when(users.emailInUse(EMAIL)).thenReturn(true);           // ang sarili niya
        when(users.emailInUseExcluding(EMAIL, 7L)).thenReturn(false);
        assertFalse(service.inUse(EMAIL, Exclude.user(7L)));
        verify(users, never()).emailInUse(anyString());
    }

    @Test
    void coordinatorEditStillBlockedByAStudent() {
        when(students.emailExists(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.user(7L)));
    }

    @Test
    void studentEditDoesNotBlockItsOwnEmail() {
        when(students.emailExists(EMAIL)).thenReturn(true);       // ang sarili niya
        when(students.emailExistsExcluding(EMAIL, 42L)).thenReturn(false);
        assertFalse(service.inUse(EMAIL, Exclude.student(42L)));
        verify(students, never()).emailExists(anyString());
    }

    @Test
    void studentEditStillBlockedByACoordinator() {
        when(users.emailInUse(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.student(42L)));
    }

    @Test
    void registrationDoesNotBlockItself() {
        when(registrations.emailTaken(EMAIL, 5L)).thenReturn(false);
        assertFalse(service.inUse(EMAIL, Exclude.registration(5L)));
        verify(registrations).emailTaken(EMAIL, 5L);
        verify(registrations, never()).emailTaken(EMAIL, null);
    }

    @Test
    void registrationBlockedByADirector() {
        when(directors.emailInUse(EMAIL)).thenReturn(true);
        assertTrue(service.inUse(EMAIL, Exclude.registration(5L)));
    }
}
