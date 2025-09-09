import os, sys, importlib, inspect

print("CWD:", os.getcwd())
print("First sys.path entry:", sys.path[0])

try:
    m = importlib.import_module("utils.redis_conn")
    print("Imported module file:", m.__file__)
    has_fn = hasattr(m, "get_redis")
    print("Has get_redis?:", has_fn)
    if has_fn:
        print("\n--- get_redis source ---")
        print(inspect.getsource(m.get_redis))
    else:
        print("\nNames in module:", [n for n in dir(m) if not n.startswith("_")])
except Exception as e:
    print("IMPORT FAILED:", repr(e))
