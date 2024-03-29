import { Subscriber } from "@redchili/pubsub";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FormContext from "../context";
import { FieldStateType, RuleType, VerifyOnType } from "../types";
import pubsub from "../utils/pubsub";
import { verifyUtil } from "../utils/verify";

interface Props {
  name: string;
  rule?: RuleType;
  verifyOn?: VerifyOnType;
}

const subscribe = new Subscriber();

const Item = (props: React.PropsWithChildren<Props>) => {
  const { children, name, rule, verifyOn } = props;
  const [value, setValue] = useState<any>();
  const [error, setError] = useState<string>();
  const [visible, setVisible] = useState(true);
  const [itemProps, setItemProps] = useState<any>();

  const visibleRef = useRef<boolean>(true);
  const nameRef = useRef(name);

  const mountedRef = useRef<boolean>(false);
  const verifyOnRef = useRef<VerifyOnType>(verifyOn ?? "blur");
  const context = useContext(FormContext);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const handleChange = (name: string, value: any) => {
    setValue(value);
    pubsub.publish("change", { [name]: value });
  };

  const verify = useCallback(
    (name: string) => {
      if (rule) {
        // TODO: 这里做校验
        const result = verifyUtil(rule, value);
        // console.log("debug verify", name, result);
        result.valid ? setError(undefined) : setError(result.message);
      }
    },

    [value]
  );

  const startValues = useMemo(() => {
    return {
      ...(context?.defaultValues ?? {}),
      ...(context?.initialValues ?? {}),
    };
  }, [context]);

  useEffect(() => {
    if (name in startValues) {
      setValue(startValues[name]);
    }
  }, [context]);

  useEffect(() => {
    pubsub.subscribe("reset", subscribe, () => {
      if (name in startValues) {
        setValue(startValues[name]);
      } else {
        setValue(undefined);
      }
      setError(undefined);
    });
    pubsub.subscribe(
      "setState",
      subscribe,
      ({ key, fieldState }: { key: string; fieldState: FieldStateType }) => {
        if (key !== nameRef.current) {
          return;
        }
        if ("value" in fieldState) {
          setValue(fieldState.value);
        }
        if ("props" in fieldState) {
          setItemProps(fieldState.props);
        }
        if ("error" in fieldState) {
          setError(fieldState.error);
        }
        if ("visible" in fieldState) {
          if (visibleRef.current !== fieldState.visible) {
            setVisible(!!fieldState.visible);
            if (fieldState.visible) {
              pubsub.publish("show", nameRef.current);
            } else {
              pubsub.publish("hide", nameRef.current);
            }
          }
        }
      }
    );
    return () => {
      pubsub.unsubscribe();
    };
  }, [context]);

  useEffect(() => {
    pubsub.publish("change", { [nameRef.current]: value });
    pubsub.publish("onValueChange", {
      key: nameRef.current,
      data: { value },
    });
  }, [value]);

  useEffect(() => {
    if (context && rule) {
      context.setFieldRules({ [nameRef.current]: rule });
    }
  }, [context, rule]);

  const bind = useCallback(
    (child: React.ReactNode) => {
      if (!React.isValidElement(child)) {
        return null;
      }

      const childProps = {
        ...child.props,
        ...itemProps,
        ...{
          value,
          error, // 校验结果
          onChange: (event: any) => {
            handleChange(nameRef.current, event);
          },
          onBlur: () => {
            verifyOnRef.current === "blur" && verify(nameRef.current);
          },
        },
        // style: {
        //   display: visible ? "" : "none",
        // },
      };
      return visible ? React.cloneElement(child, childProps) : null;
    },
    [value, error, handleChange, verify, visible]
  );

  return <>{React.Children.map(children, bind)}</>;
};

export default React.memo(Item);
