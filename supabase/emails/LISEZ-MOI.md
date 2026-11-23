# Les e-mails du compte

À coller dans Supabase, projet ludiworld, Authentication > Emails (onglet Templates).

Chaque e-mail part dans la langue du parent : Supabase lit `langue` dans les données du compte (`user_metadata`, `.Data.langue` dans le modèle) et ne garde que le texte anglais ou le texte français. Une autre langue, ou aucune : le français. Le site la tient à jour (`LudiNuage.retenirLangue`) : à l'inscription, à la connexion, quand le parent change de langue sur le site ou dans l'appli, et juste avant d'envoyer le code du « Code oublié ? ». Une nouvelle langue : une branche de plus dans chaque modèle et chaque objet (`{{ else if eq ... "de" }}`).

### Confirm signup

Objet (Subject heading), à copier tel quel :

```
{{ if eq (printf "%v" .Data.langue) "en" }}Ludiworld: confirm your address{{ else }}Ludiworld : confirmez votre adresse{{ end }}
```

Texte (Message body) : tout le fichier `1-confirmation.html`.

### Magic Link

Objet (Subject heading), à copier tel quel :

```
{{ if eq (printf "%v" .Data.langue) "en" }}Ludiworld: your code{{ else }}Ludiworld : votre code{{ end }}
```

Texte (Message body) : tout le fichier `2-code-oublie.html`.

### Reset Password

Objet (Subject heading), à copier tel quel :

```
{{ if eq (printf "%v" .Data.langue) "en" }}Ludiworld: new password{{ else }}Ludiworld : nouveau mot de passe{{ end }}
```

Texte (Message body) : tout le fichier `3-mot-de-passe.html`.

### Change Email Address

Objet (Subject heading), à copier tel quel :

```
{{ if eq (printf "%v" .Data.langue) "en" }}Ludiworld: new address{{ else }}Ludiworld : nouvelle adresse{{ end }}
```

Texte (Message body) : tout le fichier `4-changement-adresse.html`.

« Magic Link » sert au « Code oublié ? » de l'appli (`/auth/v1/otp`, puis `/auth/v1/verify` type `email`) : il doit contenir `{{ .Token }}`, le code à 6 chiffres. Ludiworld n'utilise pas la connexion par lien : ce modèle n'a pas de bouton.

« Il ne marche qu'une fois, et pendant une heure » : la durée par défaut de Supabase (Email OTP Expiration, 3600 s, dans Sign In / Providers > Email). Si on la change, changer la phrase.
