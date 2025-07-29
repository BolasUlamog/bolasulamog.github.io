#include <stdio.h>
#include <string.h>

int main() {
    char input[50];
    char password[] = "pa$$w0rd";

    printf("Enter the password: ");
    fgets(input, 50, stdin);
    input[strcspn(input, "\n")] = '\0';

    if (strcmp(input, password) == 0) {
        printf("Welcome! The flag is: CTF{Ilikesoup}\n");
    } else {
        printf("Wrong password! Try again.\n");
    }

    return 0;
}