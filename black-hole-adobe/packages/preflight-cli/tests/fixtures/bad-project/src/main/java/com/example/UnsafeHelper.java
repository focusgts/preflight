package com.example;

import sun.misc.Unsafe;
import java.lang.reflect.Field;

public class UnsafeHelper {
    public static Unsafe getUnsafe() throws Exception {
        Field f = Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        return (Unsafe) f.get(null);
    }
}
