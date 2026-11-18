/**
 * Declaration-merge activations.
 *
 * Every DSH slot lives in a `SlotMap` that its *owning* package merges into
 * `@deepseek-ai/dsh-client-ui-slots`, and `ctx.slots` itself is merged into
 * cordis' `Context` by `@deepseek-ai/dsh-client-ui-renderer`. TypeScript applies
 * a merge only when the augmenting declaration file is part of the program, and
 * the merges live in each package's `/client` entry (the default `.` entry is the
 * Node-side half and augments nothing). A plugin must therefore name the host
 * packages whose seats it uses. These imports are erased at build time: at
 * runtime every one of them comes from the shell's frozen module table.
 */
import '@deepseek-ai/dsh-client-ui-renderer/client'
import '@deepseek-ai/dsh-client-ui-layout/client'
import '@deepseek-ai/dsh-client-ui-sidebar/client'
