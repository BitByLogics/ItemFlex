package net.vaultedmc.itemflex.web;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@RequiredArgsConstructor
public class EditorSession {

    private final String id;
    private final UUID playerId;
    private final String playerName;
    private final boolean canEditCommands;

    @Setter
    private long expiresAt;

}
