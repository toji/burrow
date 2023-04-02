# Burrow

A toy WebGPU deferred renderer built on my WIP hoard-gpu asset loading library.

## Features

 - Deferred rendering with WebGPU!
    - Antialising support: No
    - Transparency support: Also no
    - Anything approaching a useful abstraction layer: Nope!
 - glTF loading
    - Animations: No
    - Most extensions: No
    - Basis and Draco compression: Surprisingly, yes!
 - Point lights and Image based lights
    - Mathmatically rigorous: LOL, No.
    - Energy conserving: Ha!
    - Cobbled together from dozens of GLSL snippets found all around the web, smashed together without regard for compatibility until the result looked kinda plausible and I shipped it?: _This is the way._