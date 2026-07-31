I have an idea, okay?

I'm building a health-related application. One of the features I want to include is a Journal feature.

The Journal feature will allow users to record their daily activities, just like a personal diary. Teenagers and young adults often like to write about their daily lives, add photos, write captions below those photos, and save memories in an attractive story-like format. The goal is to let users create beautiful, personal journal entries with text and images.

Now, here's the problem I'm trying to solve:

Suppose a user has been using the journal for a long time and later buys a new phone. How should they transfer all of their journal entries to the new device while keeping their privacy protected?

I have three possible approaches.

Option 1: Store everything on the server

The first approach is to upload all journal data to the server.

When the user installs the app on a new phone, they simply log in with their account, and the journal is downloaded from the server.

This is simple, but I don't like it because journals are extremely personal. Sending all journal entries to the server reduces privacy, since the server stores the user's private diary.

Option 2: Separate Journal Module with a Secure Transfer Link

The second idea is to keep the Journal as a separate module.

Instead of syncing it with the user's account, the Journal would work independently.

When the user wants to move to a new phone, they open the old device and choose Create Transfer Link.

The app generates a secure, encrypted transfer link.

On the new phone, the user installs the Journal module, pastes the transfer link, and the journal is transferred securely.

The Journal remains independent from the login system because I don't want it to depend on the user's account or require storing journal data on the server.

Option 3: End-to-End Encryption with a User Password (My Favorite Idea)

My third idea is to use encryption.

On the old phone, the user creates their own password (or encryption key).

The app encrypts the entire journal using a strong encryption algorithm and that password.

The encrypted journal is then uploaded to the server.

However, the important point is that the server never knows the encryption key or password.

Only the user knows it.

Later, when the user installs the app on a new phone:

They log in to their account.
They open the Journal module.
The encrypted journal is downloaded.
The user enters the same password they originally created.
The app decrypts the journal locally on the new phone.

In this approach, the server only stores encrypted data and never has access to the user's actual journal or the encryption key.

My Question

Which of these three approaches would be the best in terms of:

Privacy
Security
Ease of use
Scalability
Real-world feasibility

I want the Journal to feel like a truly private personal diary, so protecting the user's privacy is my highest priority.