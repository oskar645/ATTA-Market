(function attachAttaSupabase(global) {
  const defaultConfig = {
    url: "https://molsaoepvgbnfwbwldqv.supabase.co",
    anonKey: "sb_publishable_dAhJXoA5cHBPLEuuhVnAwA_Dnivnkmi",
    storageBucket: "listing-photos",
    supportEmail: "dagalaev9588@gmail.com",
    functions: {
      support: "send-support-email",
    },
    tables: {
      listings: "listings",
      chats: "chats",
      messages: "chat_messages",
      profiles: "users",
      supportRequests: "support_requests",
    },
  };

  const fallbackImage =
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

  const config = {
    ...defaultConfig,
    ...(global.ATTA_SUPABASE_CONFIG || {}),
    tables: {
      ...defaultConfig.tables,
      ...((global.ATTA_SUPABASE_CONFIG && global.ATTA_SUPABASE_CONFIG.tables) || {}),
    },
    functions: {
      ...defaultConfig.functions,
      ...((global.ATTA_SUPABASE_CONFIG && global.ATTA_SUPABASE_CONFIG.functions) || {}),
    },
  };

  const hasClientLib = !!global.supabase?.createClient;
  const isEnabled = hasClientLib && !!config.url && !!config.anonKey;
  const client = isEnabled ? global.supabase.createClient(config.url, config.anonKey) : null;

  function firstValue(row, keys, fallback = null) {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }
    return fallback;
  }

  function normalizeText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function toAbsoluteImage(value) {
    if (!value) return null;

    if (typeof value === "object") {
      return (
        value.publicUrl ||
        value.url ||
        value.src ||
        value.path ||
        value.image_url ||
        value.image ||
        null
      );
    }

    if (typeof value !== "string") return null;
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image")) {
      return value;
    }
    if (value.startsWith("/storage/") || value.startsWith("storage/")) {
      return `${config.url}${value.startsWith("/") ? value : `/${value}`}`;
    }
    if (value.includes("/storage/v1/object/public/")) {
      return `${config.url}${value.startsWith("/") ? value : `/${value}`}`;
    }
    if (value.startsWith(`${config.storageBucket}/`)) {
      return `${config.url}/storage/v1/object/public/${value}`;
    }
    if (config.storageBucket) {
      return `${config.url}/storage/v1/object/public/${config.storageBucket}/${value.replace(/^\/+/, "")}`;
    }
    return value;
  }

  function normalizeGallery(row, fallback) {
    const rawGallery = firstValue(row, ["photo_urls", "images", "gallery", "photos", "image_urls"], []);
    const items = [rawGallery, fallback]
      .flat()
      .filter(Boolean)
      .map(toAbsoluteImage)
      .filter(Boolean);

    return [...new Set(items)];
  }

  function normalizeListing(row) {
    const car = row?.car && typeof row.car === "object" ? row.car : {};
    const directImage = toAbsoluteImage(
      firstValue(
        row,
        ["image_url", "image", "cover", "photo_url", "main_image", "imageUrl", "preview_image", "photo"],
        null,
      ),
    );
    const gallery = normalizeGallery(row, directImage || fallbackImage);
    const ownerId = firstValue(row, ["owner_id", "user_id", "author_id", "seller_id"], null);
    const ownerEmail = normalizeText(firstValue(row, ["owner_email", "email"], ""), "");
    const ownerName = normalizeText(firstValue(row, ["owner_name", "seller_name", "author_name", "user_name"], ""), "");
    const sellerLabel = ownerName || ownerEmail || "Пользователь";

    return {
      id: String(row.id ?? `remote-${Date.now()}`),
      userId: ownerId,
      ownerId,
      ownerEmail,
      ownerName,
      title: normalizeText(firstValue(row, ["title", "name"], "Без названия"), "Без названия"),
      category: normalizeText(firstValue(row, ["category", "section"], "Без категории"), "Без категории"),
      city: normalizeText(firstValue(row, ["city", "location", "region", "address"], "Не указан"), "Не указан"),
      price: Number(firstValue(row, ["price", "amount"], 0)),
      seller: sellerLabel,
      sellerRating: Number(firstValue(row, ["seller_rating", "rating"], 5)),
      image: gallery[0] || fallbackImage,
      gallery,
      description: normalizeText(firstValue(row, ["description", "body", "text"], ""), ""),
      status: normalizeText(firstValue(row, ["status"], "approved"), "approved"),
      phone: normalizeText(firstValue(row, ["phone", "phone_number", "contact_phone"], "+79990000000"), "+79990000000"),
      year: Number(firstValue(car, ["year"], firstValue(row, ["year"], new Date().getFullYear()))),
      condition: normalizeText(firstValue(car, ["condition"], firstValue(row, ["condition"], "Не указано")), "Не указано"),
      drive: normalizeText(firstValue(car, ["drive"], firstValue(row, ["drive"], "Не указан")), "Не указан"),
      transmission: normalizeText(
        firstValue(car, ["transmission", "gearbox"], firstValue(row, ["transmission", "gearbox"], "Не указана")),
        "Не указана",
      ),
      fuel: normalizeText(firstValue(car, ["fuel_type", "fuel"], firstValue(row, ["fuel"], "Не указано")), "Не указано"),
      mileage: Number(firstValue(car, ["mileage"], firstValue(row, ["mileage", "run"], 0))),
      body: normalizeText(firstValue(row, ["subcategory", "body", "type"], "Не указано"), "Не указано"),
      color: normalizeText(firstValue(car, ["color"], firstValue(row, ["color"], "Не указан")), "Не указан"),
    };
  }

  function normalizeProfile(authUser, profile) {
    if (!authUser) return null;

    const displayName =
      firstValue(profile, ["display_name", "name"], null) ||
      authUser.user_metadata?.display_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Гость";

    return {
      ...authUser,
      profile: profile || null,
      display_name: displayName,
      name: firstValue(profile, ["name"], authUser.user_metadata?.name || displayName),
      phone: firstValue(profile, ["phone"], authUser.user_metadata?.phone || ""),
      avatar_url: firstValue(profile, ["avatar_url", "photo_url"], authUser.user_metadata?.avatar_url || ""),
      email: authUser.email || firstValue(profile, ["email"], ""),
    };
  }

  function buildInbox(chats, messages, profilesMap, currentUserId, currentUserEmail) {
    const threads = {};
    const labels = {};

    for (const chat of chats || []) {
      const chatId = String(firstValue(chat, ["id"], ""));
      if (!chatId) continue;

      const buyerId = String(firstValue(chat, ["buyer_id"], ""));
      const sellerId = String(firstValue(chat, ["seller_id"], ""));
      const otherId = buyerId === String(currentUserId) ? sellerId : buyerId;
      const otherProfile = profilesMap[otherId] || {};
      const label =
        firstValue(otherProfile, ["display_name", "name", "email"], null) ||
        firstValue(chat, ["listing_title"], null) ||
        "Чат";

      labels[chatId] = label;
      threads[chatId] = (messages || [])
        .filter((row) => String(firstValue(row, ["chat_id"], "")) === chatId)
        .map((row) => {
          const senderId = String(firstValue(row, ["sender_id"], ""));
          const senderProfile = profilesMap[senderId] || {};
          const isMine = senderId === String(currentUserId);
          return {
            id: String(row.id ?? `${chatId}-${Date.now()}`),
            chatId,
            author:
              firstValue(senderProfile, ["display_name", "name", "email"], null) ||
              (isMine ? currentUserEmail || "Вы" : label),
            text: normalizeText(firstValue(row, ["text"], ""), ""),
            side: isMine ? "self" : "partner",
          };
        });
    }

    return { threads, labels };
  }

  async function safeQuery(run, fallback) {
    if (!client) return fallback;
    try {
      const result = await run();
      if (result.error) return fallback;
      return result.data ?? fallback;
    } catch {
      return fallback;
    }
  }

  global.attaSupabase = {
    enabled: isEnabled,
    config,
    async signIn(email, password) {
      if (!client) return { ok: false, message: "Supabase не настроен" };
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: error.message };
      return { ok: true, user: data.user };
    },
    async signUp(email, password) {
      if (!client) return { ok: false, message: "Supabase не настроен" };
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { ok: false, message: error.message };
      return { ok: true, user: data.user };
    },
    async signOut() {
      if (!client) return { ok: false };
      await client.auth.signOut();
      return { ok: true };
    },
    async getCurrentUser() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      const authUser = data?.user || null;
      if (!authUser?.id) return authUser;

      const profile = await safeQuery(
        () => client.from(config.tables.profiles).select("*").eq("id", authUser.id).maybeSingle(),
        null,
      );

      return normalizeProfile(authUser, profile);
    },
    async loadListings() {
      const rows = await safeQuery(
        () =>
          client
            .from(config.tables.listings)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100),
        [],
      );
      return rows.map(normalizeListing);
    },
    async createListing(listing) {
      if (!client) return { ok: false };

      try {
        const { data: userData } = await client.auth.getUser();
        const authUser = userData?.user || null;
        const userId = authUser?.id || null;
        const payload = {
          owner_id: userId,
          owner_email: authUser?.email || listing.ownerEmail || listing.seller,
          owner_name:
            authUser?.user_metadata?.display_name ||
            authUser?.user_metadata?.name ||
            listing.ownerName ||
            listing.seller,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          subcategory: listing.body,
          price: listing.price,
          phone: listing.phone,
          city: listing.city,
          photo_urls: Array.isArray(listing.gallery) ? listing.gallery.filter(Boolean) : [],
          status: listing.status || "pending",
          car: {
            year: listing.year,
            condition: listing.condition,
            drive: listing.drive,
            transmission: listing.transmission,
            fuel: listing.fuel,
            mileage: listing.mileage,
            color: listing.color,
          },
        };

        const { error } = await client.from(config.tables.listings).insert(payload);
        return { ok: !error, error };
      } catch (error) {
        return { ok: false, error };
      }
    },
    async loadChats() {
      const rows = await safeQuery(
        () =>
          client
            .from(config.tables.chats)
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(200),
        [],
      );
      return rows;
    },
    async loadThreads() {
      const { data: userData } = await client.auth.getUser();
      const currentUserId = userData?.user?.id || null;
      const currentUserEmail = userData?.user?.email || null;
      if (!currentUserId) return { threads: {}, labels: {} };

      const chats = await this.loadChats();
      const myChats = (chats || []).filter((chat) => {
        const buyerId = String(firstValue(chat, ["buyer_id"], ""));
        const sellerId = String(firstValue(chat, ["seller_id"], ""));
        return buyerId === String(currentUserId) || sellerId === String(currentUserId);
      });

      const chatIds = myChats.map((chat) => String(firstValue(chat, ["id"], ""))).filter(Boolean);
      const profileIds = [
        ...new Set(
          myChats
            .flatMap((chat) => [chat.buyer_id, chat.seller_id])
            .filter(Boolean)
            .map(String),
        ),
      ];

      const profiles = profileIds.length
        ? await safeQuery(() => client.from(config.tables.profiles).select("*").in("id", profileIds), [])
        : [];

      const profilesMap = Object.fromEntries((profiles || []).map((profile) => [String(profile.id), profile]));

      const messages = chatIds.length
        ? await safeQuery(
            () =>
              client
                .from(config.tables.messages)
                .select("*")
                .in("chat_id", chatIds)
                .order("created_at", { ascending: true })
                .limit(500),
            [],
          )
        : [];

      return buildInbox(myChats, messages, profilesMap, currentUserId, currentUserEmail);
    },
    async ensureChatForListing(listing) {
      if (!client) return { ok: false, message: "Supabase не настроен" };

      try {
        const { data: userData } = await client.auth.getUser();
        const authUser = userData?.user || null;
        const buyerId = authUser?.id || null;
        const sellerId = listing?.ownerId || listing?.userId || null;

        if (!buyerId || !sellerId || !listing?.id) {
          return { ok: false, message: "Не удалось определить чат для объявления" };
        }

        if (String(buyerId) === String(sellerId)) {
          return { ok: false, message: "Нельзя написать самому себе" };
        }

        let chat = await safeQuery(
          () =>
            client
              .from(config.tables.chats)
              .select("*")
              .eq("listing_id", listing.id)
              .eq("buyer_id", buyerId)
              .eq("seller_id", sellerId)
              .maybeSingle(),
          null,
        );

        if (!chat) {
          const { data, error } = await client
            .from(config.tables.chats)
            .insert({
              listing_id: listing.id,
              listing_title: listing.title || "",
              buyer_id: buyerId,
              seller_id: sellerId,
              last_message: "",
              unread_for_buyer: 0,
              unread_for_seller: 0,
            })
            .select("*")
            .single();

          if (error) return { ok: false, message: error.message, error };
          chat = data;
        }

        const sellerProfile = await safeQuery(
          () => client.from(config.tables.profiles).select("*").eq("id", sellerId).maybeSingle(),
          null,
        );

        return {
          ok: true,
          chatId: String(chat.id),
          label:
            firstValue(sellerProfile, ["display_name", "name", "email"], null) ||
            listing.ownerName ||
            listing.seller ||
            listing.title ||
            "Чат",
        };
      } catch (error) {
        return { ok: false, error, message: error?.message || "Не удалось открыть чат" };
      }
    },
    async sendMessage(chatId, text) {
      if (!client) return { ok: false };

      try {
        const { data: userData } = await client.auth.getUser();
        const userId = userData?.user?.id || null;
        const chat = await safeQuery(
          () => client.from(config.tables.chats).select("*").eq("id", chatId).maybeSingle(),
          null,
        );

        if (!chat) return { ok: false };

        const { error } = await client.from(config.tables.messages).insert({
          chat_id: chatId,
          text,
          sender_id: userId,
        });

        if (error) return { ok: false, error };

        const buyerId = String(firstValue(chat, ["buyer_id"], ""));
        const sellerId = String(firstValue(chat, ["seller_id"], ""));
        let unreadForBuyer = Number(firstValue(chat, ["unread_for_buyer"], 0));
        let unreadForSeller = Number(firstValue(chat, ["unread_for_seller"], 0));

        if (String(userId) === buyerId) unreadForSeller += 1;
        if (String(userId) === sellerId) unreadForBuyer += 1;

        await client
          .from(config.tables.chats)
          .update({
            last_message: text,
            updated_at: new Date().toISOString(),
            unread_for_buyer: unreadForBuyer,
            unread_for_seller: unreadForSeller,
          })
          .eq("id", chatId);

        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
    async submitSupportRequest(payload) {
      const message = normalizeText(payload?.message, "");
      const email = normalizeText(payload?.email, "");
      const name = normalizeText(payload?.name, "");

      if (!message) {
        return { ok: false, message: "Сообщение не заполнено" };
      }

      if (!client) {
        return {
          ok: false,
          fallbackMailto: true,
          supportEmail: config.supportEmail,
          message: "Supabase не настроен",
        };
      }

      try {
        if (config.functions?.support) {
          const { data, error } = await client.functions.invoke(config.functions.support, {
            body: {
              message,
              email,
              name,
              supportEmail: config.supportEmail,
              source: "website",
            },
          });

          if (!error) {
            return {
              ok: true,
              delivery: "function",
              data,
              supportEmail: config.supportEmail,
            };
          }
        }

        const { data: userData } = await client.auth.getUser();
        const userId = userData?.user?.id || null;
        const { error } = await client.from(config.tables.supportRequests).insert({
          user_id: userId,
          email,
          name,
          message,
          support_email: config.supportEmail,
          source: "website",
          status: "new",
        });

        if (error) {
          return {
            ok: false,
            error,
            fallbackMailto: true,
            supportEmail: config.supportEmail,
            message: error.message || "Не удалось отправить обращение",
          };
        }

        return {
          ok: true,
          delivery: "table",
          supportEmail: config.supportEmail,
        };
      } catch (error) {
        return {
          ok: false,
          error,
          fallbackMailto: true,
          supportEmail: config.supportEmail,
          message: error?.message || "Не удалось отправить обращение",
        };
      }
    },
  };
})(window);
